import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { X, Upload, Plus, Trash2, Loader2, AlertTriangle, ZoomIn, ZoomOut, RotateCcw, Sparkles, Check } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { requireCurrentBranchId } from "@/lib/current-branch";
import { parseInvoiceImage, learnFromCorrection, type ParsedInvoice } from "@/lib/invoice-ocr.functions";
import { loadSupplierProducts, type SupplierProduct } from "@/lib/supplier-products";
import { ModalDeleteButton } from "@/components/ModalDeleteButton";

interface SupplierOpt { id: string; name: string }

interface ItemRow {
  item_name: string;
  quantity: string;
  /** מחיר בסיס — gross price per unit, before discount (user-editable). */
  base_unit_price: string;
  /** מחיר נטו ליחידה — computed = base × (1 − pct%) או base − amt. */
  unit_price: string;
  /** סה"כ — computed = quantity × unit_price (נטו). */
  total_price: string;
  /** Free-text discount, e.g. "10%" / "₪5" / "5 ש״ח". */
  discount: string;
}

/** Parse a discount string into either a percent or a flat per-unit amount. */
function parseDiscount(s: string): { type: "pct" | "amt"; value: number } | null {
  if (!s) return null;
  const trimmed = s.trim();
  if (!trimmed) return null;
  const hasPct = /%/.test(trimmed);
  const cleaned = trimmed
    .replace(/[₪$€£]/g, "")
    .replace(/ש["״']?\s*ח/g, "")
    .replace(/[^\d.\-]/g, "");
  const num = Number(cleaned);
  if (!Number.isFinite(num) || num <= 0) return null;
  return hasPct ? { type: "pct", value: num } : { type: "amt", value: num };
}

/** Net price per unit after discount. */
function computeNet(base: number, discount: string): number {
  if (!Number.isFinite(base) || base <= 0) return 0;
  const d = parseDiscount(discount);
  if (!d) return base;
  if (d.type === "pct") return Math.max(0, base * (1 - Math.min(d.value, 100) / 100));
  return Math.max(0, base - d.value);
}

const fmt2 = (n: number): string => (Number.isFinite(n) && n > 0 ? n.toFixed(2) : "");

/** Recompute unit_price (net) and total_price for a row after a field changes. */
function recalcRow(row: ItemRow): ItemRow {
  const baseN = Number(row.base_unit_price) || 0;
  const qtyN = Number(row.quantity) || 0;
  const net = computeNet(baseN, row.discount);
  return {
    ...row,
    unit_price: net > 0 ? fmt2(net) : "",
    total_price: net > 0 && qtyN > 0 ? fmt2(net * qtyN) : "",
  };
}

interface InventoryOpt { id: string; name: string; unit: string }

export interface EditInvoiceData {
  id: string;
  supplier_id: string | null;
  invoice_number: string | null;
  total_amount: number | string | null;
  document_date: string;
  image_url: string | null;
}

interface Props {
  suppliers: SupplierOpt[];
  onClose: () => void;
  onSaved: () => void;
  editInvoice?: EditInvoiceData | null;
  onDeleted?: (id: string) => void;
  initialSupplierId?: string;
  /**
   * Training mode: zero impact on operational data.
   * Only updates AI learning/mapping tables (invoice_ocr_feedback + supplier parsing_instructions).
   * Does NOT write to invoices / invoice_items / inventory.
   */
  trainingMode?: boolean;
}

const DRAFT_KEY_OPERATIONAL = "invoice-intake-draft";
const DRAFT_KEY_TRAINING = "invoice-intake-draft-training";
const DRAFT_IMAGE_DB = "invoice-intake-drafts";
const DRAFT_IMAGE_STORE = "images";
const HARD_LIMIT = 15000;

interface InvoiceDraft {
  supplierId: string;
  invoiceNumber: string;
  totalAmount: string;
  docDate: string;
  items: ItemRow[];
  rawOcr?: ParsedInvoice | null;
  headerVal?: Record<"supplier" | "invoice_number" | "document_date" | "total_amount", "pending" | "approved" | "corrected">;
  itemVal?: Array<"pending" | "approved" | "corrected">;
}


const openDraftDb = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(DRAFT_IMAGE_DB, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(DRAFT_IMAGE_STORE)) {
        request.result.createObjectStore(DRAFT_IMAGE_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const saveDraftImage = async (key: string, dataUrl: string | null) => {
  const db = await openDraftDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(DRAFT_IMAGE_STORE, "readwrite");
    const store = tx.objectStore(DRAFT_IMAGE_STORE);
    if (dataUrl) store.put(dataUrl, key);
    else store.delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
};

const loadDraftImage = async (key: string): Promise<string | null> => {
  const db = await openDraftDb();
  const value = await new Promise<string | null>((resolve, reject) => {
    const tx = db.transaction(DRAFT_IMAGE_STORE, "readonly");
    const request = tx.objectStore(DRAFT_IMAGE_STORE).get(key);
    request.onsuccess = () => resolve(typeof request.result === "string" ? request.result : null);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return value;
};

export function InvoiceIntakeModal({ suppliers, onClose, onSaved, editInvoice = null, onDeleted, initialSupplierId, trainingMode = false }: Props) {
  const isEdit = !!editInvoice;
  const [supplierId, setSupplierId] = useState(editInvoice?.supplier_id ?? initialSupplierId ?? "");

  const [invoiceNumber, setInvoiceNumber] = useState(editInvoice?.invoice_number ?? "");
  const [totalAmount, setTotalAmount] = useState(
    editInvoice?.total_amount != null ? String(editInvoice.total_amount) : "",
  );
  const [docDate, setDocDate] = useState(
    editInvoice?.document_date ?? new Date().toISOString().slice(0, 10),
  );
  const [items, setItems] = useState<ItemRow[]>([{ item_name: "", quantity: "", base_unit_price: "", unit_price: "", total_price: "", discount: "" }]);
  // === Training validation gate ===
  // Each extracted field/row must be explicitly approved (✓) or corrected (✗)
  // before "Save & Learn" is enabled. Only enforced in trainingMode.
  type ValState = "pending" | "approved" | "corrected";
  type HeaderKey = "supplier" | "invoice_number" | "document_date" | "total_amount";
  const [headerVal, setHeaderVal] = useState<Record<HeaderKey, ValState>>({
    supplier: "pending",
    invoice_number: "pending",
    document_date: "pending",
    total_amount: "pending",
  });
  const [itemVal, setItemVal] = useState<ValState[]>(["pending"]);
  const resetValidation = (rowCount: number) => {
    setHeaderVal({ supplier: "pending", invoice_number: "pending", document_date: "pending", total_amount: "pending" });
    setItemVal(Array.from({ length: Math.max(1, rowCount) }, () => "pending"));
  };
  const setHV = (k: HeaderKey, v: ValState) => setHeaderVal((p) => ({ ...p, [k]: v }));
  const setIV = (i: number, v: ValState) =>
    setItemVal((p) => {
      const next = p.length > i ? [...p] : [...p, ...Array.from({ length: i + 1 - p.length }, () => "pending" as ValState)];
      next[i] = v;
      return next;
    });
  // Keep itemVal length synced with items (e.g. when OCR populates rows without calling resetValidation).
  useEffect(() => {
    setItemVal((p) => {
      if (p.length === items.length) return p;
      if (p.length < items.length) return [...p, ...Array.from({ length: items.length - p.length }, () => "pending" as ValState)];
      return p.slice(0, items.length);
    });
  }, [items.length]);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showAnomaly, setShowAnomaly] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [inventory, setInventory] = useState<InventoryOpt[]>([]);
  const [ocrLoading, setOcrLoading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const [rawOcr, setRawOcr] = useState<ParsedInvoice | null>(null);
  const [supplierCatalog, setSupplierCatalog] = useState<SupplierProduct[]>([]);
  const runOcr = useServerFn(parseInvoiceImage);
  const runLearn = useServerFn(learnFromCorrection);
  const DRAFT_KEY = trainingMode ? DRAFT_KEY_TRAINING : DRAFT_KEY_OPERATIONAL;

  const persistDraft = (overrides: Partial<InvoiceDraft> = {}) => {
    if (isEdit) return;
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({
        supplierId,
        invoiceNumber,
        totalAmount,
        docDate,
        items,
        rawOcr,
        headerVal,
        itemVal,
        ...overrides,
      } satisfies InvoiceDraft));
    } catch { /* ignore */ }
  };

  // Explicit close: user clicked X / Escape / backdrop. Clears draft so
  // next open starts fresh. (Backgrounding the tab does NOT call this.)
  const handleExplicitClose = useCallback(() => {
    if (!isEdit) {
      try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
      saveDraftImage(DRAFT_KEY, null).catch(() => { /* ignore */ });
    }
    onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, onClose, DRAFT_KEY]);


  // Load supplier catalog whenever supplier is selected — used as RAG context for OCR.
  useEffect(() => {
    let cancelled = false;
    if (!supplierId) { setSupplierCatalog([]); return; }
    (async () => {
      try {
        const list = await loadSupplierProducts(supplierId);
        if (!cancelled) setSupplierCatalog(list);
      } catch { if (!cancelled) setSupplierCatalog([]); }
    })();
    return () => { cancelled = true; };
  }, [supplierId]);

  // Load inventory list for autocomplete
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const branchId = await requireCurrentBranchId();
        const { data } = await supabase
          .from("inventory_items")
          .select("id,name,unit")
          .eq("branch_id", branchId)
          .order("name");
        if (!cancelled) setInventory((data ?? []) as InventoryOpt[]);
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, []);



  // Load existing items when editing
  useEffect(() => {
    if (!isEdit || !editInvoice) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("invoice_items")
        .select("item_name,quantity,unit_price,total_price,sort_order")
        .eq("invoice_id", editInvoice.id)
        .order("sort_order");
      if (cancelled) return;
      const rows: ItemRow[] = (data ?? []).map((r) => ({
        item_name: r.item_name ?? "",
        quantity: r.quantity != null ? String(r.quantity) : "",
        // Existing invoices store only the net unit_price — treat it as the base
        // (no discount info was persisted). Discount stays empty so net == base.
        base_unit_price: r.unit_price != null ? String(r.unit_price) : "",
        unit_price: r.unit_price != null ? String(r.unit_price) : "",
        total_price: r.total_price != null ? String(r.total_price) : "",
        discount: "",
      }));
      if (rows.length) setItems(rows);
      // Load existing image preview via signed URL
      if (editInvoice.image_url) {
        const { data: signed } = await supabase.storage
          .from("invoice-images")
          .createSignedUrl(editInvoice.image_url, 60 * 60);
        if (!cancelled && signed?.signedUrl) setPreviewUrl(signed.signedUrl);
      }
    })();
    return () => { cancelled = true; };
  }, [isEdit, editInvoice]);

  // Restore draft (skip in edit mode). Use separate keys for training vs operational
  // so the two flows never cross-contaminate state.
  useEffect(() => {
    if (isEdit) return;
    let cancelled = false;
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const d = JSON.parse(raw);
        // Only restore supplierId from draft if no initialSupplierId was passed in,
        // otherwise the prop (e.g. selected supplier from previous screen) gets wiped.
        if (!initialSupplierId && d.supplierId) setSupplierId(d.supplierId);
        setInvoiceNumber(d.invoiceNumber ?? "");
        setTotalAmount(d.totalAmount ?? "");
        setDocDate(d.docDate ?? new Date().toISOString().slice(0, 10));
          if (Array.isArray(d.items) && d.items.length) setItems(d.items);
          if (d.rawOcr && typeof d.rawOcr === "object") setRawOcr(d.rawOcr);
          // Restore training validation states (✓ / ✗ markers and manual-edit gate)
          if (d.headerVal && typeof d.headerVal === "object") setHeaderVal(d.headerVal);
          if (Array.isArray(d.itemVal) && d.itemVal.length) setItemVal(d.itemVal);
        }
      } catch { /* ignore */ }
      loadDraftImage(DRAFT_KEY)
        .then((storedPreview) => {
          if (!cancelled && storedPreview?.startsWith("data:")) setPreviewUrl(storedPreview);
        })
        .catch(() => { /* ignore */ });
      return () => { cancelled = true; };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isEdit]);
  
    useEffect(() => {
      if (isEdit) return;
      const id = setTimeout(() => {
        persistDraft();
      }, 200);
      return () => clearTimeout(id);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [supplierId, invoiceNumber, totalAmount, docDate, items, rawOcr, headerVal, itemVal, isEdit]);
  
    // Note: preview is stored as a base64 data URL (not blob:) so it survives
    // tab backgrounding, app minimize, and OS memory pressure. No revoke needed.
  
    // Close on Escape — clears the draft (explicit user dismiss)
    useEffect(() => {
      const onKey = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          if (showAnomaly) setShowAnomaly(false);
          else handleExplicitClose();
        }
      };
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
    }, [handleExplicitClose, showAnomaly]);


  const totalNum = useMemo(() => {
    const t = totalAmount.trim();
    if (!t) return null;
    const n = Number(t);
    return Number.isFinite(n) ? n : null;
  }, [totalAmount]);
  // total_amount is OPTIONAL — delivery notes (תעודת משלוח) often have no prices.
  // Only supplier + date are required.
  const formValid = !!supplierId && !!docDate;

  const fileToDataUrl = (f: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(f);
    });

  const dataUrlToBlob = (dataUrl: string) => {
    const [meta, base64] = dataUrl.split(",");
    const mime = meta.match(/^data:(.*?);base64$/)?.[1] || "image/jpeg";
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return { blob: new Blob([bytes], { type: mime }), mime };
  };

  const onFileSelected = async (f: File | null) => {
    setFile(f);
    if (!f) {
      setPreviewUrl(null);
      saveDraftImage(DRAFT_KEY, null).catch(() => { /* ignore */ });
      return;
    }

    setUploading(true);
    setOcrLoading(true);
    try {
      // Read as base64 data URL — persists across app backgrounding,
      // unlike URL.createObjectURL() which may be revoked by the browser.
      const dataUrl = await fileToDataUrl(f);
      setPreviewUrl(dataUrl);
      await saveDraftImage(DRAFT_KEY, dataUrl).catch(() => { /* ignore */ });
      persistDraft();

      const catalogPayload = supplierCatalog.slice(0, 200).map((p) => ({
        name: p.name,
        sku: p.sku ?? null,
        unit: p.unit ?? null,
        unit_size: p.unit_size ?? null,
        price: p.price ?? null,
        barcode: p.barcode ?? null,
      }));

      const parsed = await runOcr({
        data: {
          imageDataUrl: dataUrl,
          mimeType: f.type || "image/jpeg",
          supplierId: supplierId || undefined,
          supplierCatalog: catalogPayload.length ? catalogPayload : undefined,
        },
      });
      setRawOcr(parsed);

      // Populate header fields when present
      let nextInvoiceNumber = invoiceNumber;
      let nextDocDate = docDate;
      let nextTotalAmount = totalAmount;
      let nextSupplierId = supplierId;
      let nextItems = items;
      if (parsed.invoice_number) setInvoiceNumber(parsed.invoice_number);
      if (parsed.document_date && /^\d{4}-\d{2}-\d{2}$/.test(parsed.document_date)) {
        setDocDate(parsed.document_date);
      }
      if (typeof parsed.total_amount === "number" && parsed.total_amount > 0) {
        setTotalAmount(String(parsed.total_amount));
      }
      if (parsed.invoice_number) nextInvoiceNumber = parsed.invoice_number;
      if (parsed.document_date && /^\d{4}-\d{2}-\d{2}$/.test(parsed.document_date)) nextDocDate = parsed.document_date;
      if (typeof parsed.total_amount === "number" && parsed.total_amount > 0) nextTotalAmount = String(parsed.total_amount);
      // Suggest supplier by fuzzy name match
      if (parsed.supplier_guess) {
        const guess = parsed.supplier_guess.trim().toLowerCase();
        const match = suppliers.find((s) => s.name.toLowerCase().includes(guess) || guess.includes(s.name.toLowerCase()));
        if (match) {
          setSupplierId(match.id);
          nextSupplierId = match.id;
        }
      }
      // Populate item rows
      if (Array.isArray(parsed.items) && parsed.items.length > 0) {
        nextItems = parsed.items.map((it) => {
          // Prefer AI's explicit base_unit_price; if missing, fall back to unit_price
          // (so the UI never shows an empty base column). Then recompute net+total
          // locally so the math is consistent with the discount field.
          const base = it.base_unit_price != null
            ? String(it.base_unit_price)
            : (it.unit_price != null ? String(it.unit_price) : "");
          return recalcRow({
            item_name: it.item_name ?? "",
            quantity: it.quantity != null ? String(it.quantity) : "",
            base_unit_price: base,
            unit_price: it.unit_price != null ? String(it.unit_price) : base,
            total_price: it.total_price != null ? String(it.total_price) : "",
            discount: it.discount ?? "",
          });
        });
        setItems(nextItems);
        resetValidation(nextItems.length);
        persistDraft({ supplierId: nextSupplierId, invoiceNumber: nextInvoiceNumber, totalAmount: nextTotalAmount, docDate: nextDocDate, items: nextItems, rawOcr: parsed });
        toast.success(`פוענחו ${parsed.items.length} שורות מהקבלה`);
      } else {
        resetValidation(1);
        persistDraft({ supplierId: nextSupplierId, invoiceNumber: nextInvoiceNumber, totalAmount: nextTotalAmount, docDate: nextDocDate, items: nextItems, rawOcr: parsed });
        toast.message("לא זוהו פריטים — מלא ידנית");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "פענוח נכשל";
      toast.error(`פענוח נכשל: ${msg}`);
    } finally {
      setOcrLoading(false);
      setUploading(false);
    }
  };


  const addItem = () => {
    setItems((p) => [...p, { item_name: "", quantity: "", base_unit_price: "", unit_price: "", total_price: "", discount: "" }]);
    // New manual rows count as already "corrected" (user-authored) so they don't block save.
    setItemVal((p) => [...p, "corrected"]);
  };
  const updateItem = (i: number, k: keyof ItemRow, v: string) => {
    setItems((p) => p.map((row, idx) => {
      if (idx !== i) return row;
      const next: ItemRow = { ...row, [k]: v };
      if (k === "base_unit_price" || k === "discount" || k === "quantity") {
        return recalcRow(next);
      }
      return next;
    }));
    // Editing an AI-suggested row implicitly marks it as corrected.
    setItemVal((p) => p.map((s, idx) => (idx === i && s === "pending" ? "corrected" : s)));
  };
  const removeItem = (i: number) => {
    setItems((p) => p.filter((_, idx) => idx !== i));
    setItemVal((p) => p.filter((_, idx) => idx !== i));
  };

  // Editing a header field while AI suggestion is pending → flip to corrected.
  const markHeaderEdited = useCallback((k: HeaderKey) => {
    setHeaderVal((p) => (p[k] === "pending" ? { ...p, [k]: "corrected" } : p));
  }, []);

  // Training-only: all header fields + all items must be resolved (approved or corrected).
  const allValidated = useMemo(() => {
    const headerOk = (Object.values(headerVal) as ValState[]).every((s) => s !== "pending");
    const itemsOk = itemVal.length > 0 && itemVal.every((s) => s !== "pending");
    return headerOk && itemsOk;
  }, [headerVal, itemVal]);
  const pendingCount = useMemo(() => {
    const h = (Object.values(headerVal) as ValState[]).filter((s) => s === "pending").length;
    const it = itemVal.filter((s) => s === "pending").length;
    return h + it;
  }, [headerVal, itemVal]);

  const checkAnomaly = async (): Promise<boolean> => {
    if (totalNum == null) return false;
    if (totalNum >= HARD_LIMIT) return true;
    const { data } = await supabase
      .from("invoices")
      .select("total_amount")
      .eq("supplier_id", supplierId)
      .eq("is_archived", false)
      .order("created_at", { ascending: false })
      .limit(20);
    const list = (data ?? []).map((r) => Number(r.total_amount)).filter((n) => n > 0);
    if (list.length < 3) return false;
    const avg = list.reduce((a, b) => a + b, 0) / list.length;
    return totalNum > avg * 5;
  };

  const doSubmit = async () => {
    if (!formValid || submitting) return;
    setSubmitting(true);
    try {
      const cleanItems = items.filter((r) => r.item_name.trim());

      // ============================================================
      // TRAINING MODE: zero impact on operational data.
      // Only invoke AI learning so future OCR improves. No invoices,
      // no invoice_items, no inventory mutations, no image uploads.
      // ============================================================
      if (trainingMode) {
        if (!rawOcr || !supplierId) {
          toast.error("נדרש לסרוק תמונה ולבחור ספק לפני שמירת אימון");
          setSubmitting(false);
          return;
        }
        // Build a per-field validation breakdown so the learning pipeline can
        // distinguish AI-accurate values (approved) from human-corrected ones.
        const validation = {
          header: headerVal,
          items: items.map((r, idx) => ({
            state: itemVal[idx] ?? "pending",
            kept: !!r.item_name.trim(),
          })),
          summary: {
            approved: (Object.values(headerVal) as ValState[]).filter((s) => s === "approved").length
              + itemVal.filter((s) => s === "approved").length,
            corrected: (Object.values(headerVal) as ValState[]).filter((s) => s === "corrected").length
              + itemVal.filter((s) => s === "corrected").length,
          },
        };
        const finalData = {
          invoice_number: invoiceNumber.trim(),
          document_date: docDate,
          total_amount: totalNum,
          items: cleanItems.map((r) => ({
            item_name: r.item_name.trim(),
            quantity: Number(r.quantity) || null,
            unit_price: Number(r.unit_price) || null,
            total_price: Number(r.total_price) || null,
          })),
          _validation: validation,
        };
        const learnRes = await runLearn({ data: { supplierId, raw: rawOcr, final: finalData } })
          .catch((err) => ({ skipped: true, reason: "network", error: String(err) } as const));
        if ((learnRes as { skipped?: boolean }).skipped) {
          toast.error(`האימון לא נשמר (${(learnRes as { reason?: string }).reason ?? "שגיאה"})`);
        } else if ((learnRes as { learned?: boolean }).learned) {
          toast.success(`האימון נשמר ו-AI עודכן (${(learnRes as { summary?: string }).summary ?? ""})`);
        } else {
          toast.success("האימון נשמר — XP עודכן (AI parsing instructions לא עודכן הפעם)");
        }
        try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
        saveDraftImage(DRAFT_KEY, null).catch(() => { /* ignore */ });
        onSaved();
        onClose();
        return;
      }

      // ============================================================
      // OPERATIONAL MODE: real invoice intake writes to invoices,
      // invoice_items (and downstream inventory in other flows).
      // ============================================================
      const branchId = await requireCurrentBranchId();
      let imageUrl: string | null = editInvoice?.image_url ?? null;

      if (file || previewUrl?.startsWith("data:")) {
        const restoredImage = file ? null : dataUrlToBlob(previewUrl!);
        const uploadBody = file ?? restoredImage!.blob;
        const uploadMime = file?.type || restoredImage?.mime || "image/jpeg";
        const ext = file ? (file.name.split(".").pop() ?? "jpg").toLowerCase() : (uploadMime.includes("png") ? "png" : "jpg");
        const path = `${branchId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error: upErr } = await supabase.storage.from("invoice-images").upload(path, uploadBody, {
          contentType: uploadMime,
          upsert: false,
        });
        if (upErr) throw upErr;
        imageUrl = path;
      }

      let invoiceId: string | undefined;

      if (isEdit && editInvoice) {
        const { error: upErr } = await supabase
          .from("invoices")
          .update({
            supplier_id: supplierId,
            invoice_number: invoiceNumber.trim(),
            total_amount: totalNum ?? undefined,
            document_date: docDate,
            image_url: imageUrl,
          })
          .eq("id", editInvoice.id);
        if (upErr) throw upErr;
        invoiceId = editInvoice.id;
        // Replace items
        await supabase.from("invoice_items").delete().eq("invoice_id", invoiceId);
      } else {
        const { data: invoiceRow, error } = await supabase
          .from("invoices")
          .insert({
            branch_id: branchId,
            supplier_id: supplierId,
            invoice_number: invoiceNumber.trim(),
            total_amount: totalNum ?? undefined,
            document_date: docDate,
            image_url: imageUrl,
            status: "pending_review",
          })
          .select("id")
          .single();
        if (error) throw error;
        invoiceId = invoiceRow?.id;
      }

      if (cleanItems.length && invoiceId) {
        const rows = cleanItems.map((r, idx) => ({
          invoice_id: invoiceId,
          item_name: r.item_name.trim().slice(0, 200),
          quantity: Number(r.quantity) || 0,
          unit_price: Number(r.unit_price) || 0,
          total_price: Number(r.total_price) || (Number(r.quantity) * Number(r.unit_price)) || 0,
          sort_order: idx,
        }));
        await supabase.from("invoice_items").insert(rows);
      }

      if (!isEdit) {
        try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
        saveDraftImage(DRAFT_KEY, null).catch(() => { /* ignore */ });
      }
      toast.success(isEdit ? "החשבונית עודכנה בהצלחה" : "החשבונית נקלטה בהצלחה");

      // Fire-and-forget autonomous learning: compare raw OCR vs user-corrected data
      if (!isEdit && rawOcr && supplierId) {
        const finalData = {
          invoice_number: invoiceNumber.trim(),
          document_date: docDate,
          total_amount: totalNum,
          items: cleanItems.map((r) => ({
            item_name: r.item_name.trim(),
            quantity: Number(r.quantity) || null,
            unit_price: Number(r.unit_price) || null,
            total_price: Number(r.total_price) || null,
          })),
        };
        runLearn({ data: { supplierId, invoiceId, raw: rawOcr, final: finalData } })
          .catch(() => { /* silent background task */ });
      }

      onSaved();
      onClose();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "שגיאה בקליטה";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };



  const handleConfirm = async () => {
    if (!formValid || submitting) return;
    // Skip anomaly checks in training mode — no operational impact.
    if (!trainingMode && (await checkAnomaly())) {
      setShowAnomaly(true);
      return;
    }
    doSubmit();
  };


  // Per-field validation buttons (training only). ✓ = AI got it right, ✗ = needs fix.
  const ValBtns = ({ state, onApprove, onReject, size = "sm" }: {
    state: ValState;
    onApprove: () => void;
    onReject: () => void;
    size?: "sm" | "md";
  }) => {
    const dim = size === "md" ? "h-9 w-9" : "h-7 w-7";
    return (
      <div className="inline-flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={onApprove}
          aria-label="אישור — ה-AI צדק"
          title="ה-AI צדק"
          className={`${dim} grid place-content-center rounded-md border transition ${
            state === "approved"
              ? "bg-emerald-500 border-emerald-400 text-black shadow-[0_0_10px_rgba(16,185,129,0.5)]"
              : "border-border text-muted-foreground hover:border-emerald-400 hover:text-emerald-400"
          }`}
        >
          <Check className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={onReject}
          aria-label="טעות — תיקון ידני"
          title="טעות — תקן ידנית"
          className={`${dim} grid place-content-center rounded-md border transition ${
            state === "corrected"
              ? "bg-rose-500 border-rose-400 text-white shadow-[0_0_10px_rgba(244,63,94,0.5)]"
              : "border-border text-muted-foreground hover:border-rose-400 hover:text-rose-400"
          }`}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  };
  const valBorder = (s: ValState) =>
    s === "approved"
      ? "border-emerald-500/60"
      : s === "corrected"
        ? "border-rose-500/70 ring-1 ring-rose-500/30"
        : "border-border";

  return (
    <div className="fixed inset-0 z-50 bg-background/90 backdrop-blur-sm grid place-items-center p-3" onClick={handleExplicitClose} dir="rtl">
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-5xl bg-card border border-border rounded-2xl overflow-hidden max-h-[94vh] flex flex-col"
      >
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div>
            <div className="text-[10px] uppercase tracking-[0.25em] text-neon font-bold">{trainingMode ? "AI Training · Sandbox" : "Goods Receiving"}</div>
            <h3 className="font-display text-xl font-bold">{trainingMode ? "אימון AI מקבלה (לא נשמר במלאי)" : isEdit ? "עריכת חשבונית" : "קליטת חשבונית חדשה"}</h3>
          </div>
          <button onClick={handleExplicitClose} className="h-8 w-8 grid place-content-center rounded-md border border-border hover:text-neon" aria-label="סגור">

            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid md:grid-cols-2 gap-0 flex-1 md:overflow-hidden overflow-y-auto overflow-x-hidden min-w-0">
          {/* Image side: sticky on both mobile (top of scroll) and desktop (side panel) */}
          <div className="bg-zinc-900/60 border-b md:border-b-0 md:border-l border-border flex flex-col sticky top-0 z-20 md:self-start md:h-full md:max-h-[94vh] max-h-[42vh] shadow-md md:shadow-none">
            <div className="p-2 md:p-3 flex items-center justify-between gap-2 border-b border-border/50 shrink-0">
              <input
                ref={fileInput}
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={(e) => onFileSelected(e.target.files?.[0] ?? null)}
              />
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                className="inline-flex items-center gap-1.5 h-8 md:h-9 px-2.5 md:px-3 rounded-md border border-border hover:border-neon hover:text-neon text-xs md:text-sm font-bold"
              >
                <Upload className="h-3.5 w-3.5 md:h-4 md:w-4" />
                {file ? "החלף" : "העלה תמונה"}
              </button>
              {previewUrl && (
                <div className="flex items-center gap-1">
                  <button onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))} className="h-8 w-8 md:h-9 md:w-9 grid place-content-center rounded-md border border-border hover:text-neon" aria-label="הקטן">
                    <ZoomOut className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => setZoom(1)} className="h-8 w-8 md:h-9 md:w-9 grid place-content-center rounded-md border border-border hover:text-neon" aria-label="אפס">
                    <RotateCcw className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => setZoom((z) => Math.min(3, z + 0.25))} className="h-8 w-8 md:h-9 md:w-9 grid place-content-center rounded-md border border-border hover:text-neon" aria-label="הגדל">
                    <ZoomIn className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
            <div className="relative flex-1 overflow-auto min-h-[140px] md:min-h-[260px] grid place-items-center p-2 md:p-4">
              {previewUrl ? (
                <>
                  <img
                    src={previewUrl}
                    alt="חשבונית"
                    style={{ transform: `scale(${zoom})`, transformOrigin: "center" }}
                    className="max-w-full max-h-full object-contain transition-transform"
                  />
                  {(uploading || ocrLoading) && (
                    <div className="absolute inset-0 pointer-events-none overflow-hidden">
                      <div className="absolute inset-x-0 h-1 bg-neon/70 shadow-[0_0_18px_var(--neon)] scan-bar" />
                      <div className="absolute inset-0 bg-background/40 grid place-items-center">
                        <div className="inline-flex items-center gap-2 rounded-full bg-card/90 border border-neon/60 px-4 py-2 text-sm font-bold text-neon shadow-[0_0_18px_rgba(57,255,20,0.35)]">
                          <Sparkles className="h-4 w-4 animate-pulse" />
                          מפענח נתוני קבלה...
                        </div>
                      </div>
                    </div>
                  )}

                </>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInput.current?.click()}
                  className="text-center text-muted-foreground text-sm border-2 border-dashed border-border rounded-xl p-6 md:p-8 hover:border-neon hover:text-neon transition"
                >
                  <Upload className="h-7 w-7 md:h-8 md:w-8 mx-auto mb-2" />
                  לחץ להעלאת תמונת חשבונית
                </button>
              )}
            </div>
            <style>{`
              @keyframes scanY { 0%{top:0} 100%{top:100%} }
              .scan-bar { animation: scanY 1.6s linear infinite; top: 0; }
            `}</style>
          </div>

          {/* Form side: independent scroll on desktop */}
          <div className="min-w-0 md:overflow-y-auto overflow-x-hidden p-3 md:p-5 flex flex-col gap-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-muted-foreground">ספק</label>
                {trainingMode && (
                  <ValBtns
                    state={headerVal.supplier}
                    onApprove={() => setHV("supplier", "approved")}
                    onReject={() => setHV("supplier", "corrected")}
                  />
                )}
              </div>
              <select
                value={supplierId}
                onChange={(e) => { setSupplierId(e.target.value); if (trainingMode) markHeaderEdited("supplier"); }}
                className={`w-full h-11 rounded-md bg-background border px-2.5 text-sm focus:border-neon outline-none ${trainingMode ? valBorder(headerVal.supplier) : "border-border"}`}
              >
                <option value="">בחר ספק…</option>
                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-muted-foreground">מס׳ חשבונית</label>
                  {trainingMode && (
                    <ValBtns
                      state={headerVal.invoice_number}
                      onApprove={() => setHV("invoice_number", "approved")}
                      onReject={() => setHV("invoice_number", "corrected")}
                    />
                  )}
                </div>
                <input
                  value={invoiceNumber}
                  onChange={(e) => { setInvoiceNumber(e.target.value); if (trainingMode) markHeaderEdited("invoice_number"); }}
                  className={`w-full h-11 rounded-md bg-background border px-2.5 text-sm focus:border-neon outline-none ${trainingMode ? valBorder(headerVal.invoice_number) : "border-border"}`}
                  maxLength={60}
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-muted-foreground">
                    תאריך <span className="text-destructive">*</span>
                  </label>
                  {trainingMode && (
                    <ValBtns
                      state={headerVal.document_date}
                      onApprove={() => setHV("document_date", "approved")}
                      onReject={() => setHV("document_date", "corrected")}
                    />
                  )}
                </div>
                <input
                  type="date"
                  value={docDate}
                  onChange={(e) => { setDocDate(e.target.value); if (trainingMode) markHeaderEdited("document_date"); }}
                  required
                  className={`w-full h-11 rounded-md bg-background border px-2.5 text-sm focus:border-neon outline-none ${trainingMode ? valBorder(headerVal.document_date) : "border-border"}`}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-muted-foreground">
                  סכום כולל ₪ <span className="text-destructive">*</span>
                </label>
                {trainingMode && (
                  <ValBtns
                    state={headerVal.total_amount}
                    onApprove={() => setHV("total_amount", "approved")}
                    onReject={() => setHV("total_amount", "corrected")}
                  />
                )}
              </div>
              <input
                type="number"
                step="0.01"
                inputMode="decimal"
                value={totalAmount}
                onChange={(e) => { setTotalAmount(e.target.value); if (trainingMode) markHeaderEdited("total_amount"); }}
                required
                className={`w-full h-11 rounded-md bg-background border-2 px-2.5 text-base font-bold focus:border-neon outline-none tabular-nums ${trainingMode ? valBorder(headerVal.total_amount) : "border-border"}`}
              />
            </div>

            <div className="pt-2">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">פריטים ({items.length})</span>
                <button type="button" onClick={addItem} className="text-xs font-bold text-neon inline-flex items-center gap-1 h-9 px-2.5 rounded-md border border-neon/40 hover:bg-neon/10">
                  <Plus className="h-4 w-4" /> הוסף פריט
                </button>
              </div>
              <datalist id="inventory-items-list">
                {inventory.map((it) => (
                  <option key={it.id} value={it.name}>{it.unit}</option>
                ))}
              </datalist>
              <div className="space-y-2.5">
                {items.map((row, i) => {
                  const qtyN = Number(row.quantity) || 0;
                  const baseN = Number(row.base_unit_price) || 0;
                  const netN = computeNet(baseN, row.discount);
                  const totalN = netN * qtyN;
                  const hasDiscount = !!parseDiscount(row.discount);
                  const rowState: ValState = itemVal[i] ?? "pending";
                  const rowBorder = trainingMode
                    ? (rowState === "approved"
                        ? "border-emerald-500/60"
                        : rowState === "corrected"
                          ? "border-rose-500/70 ring-1 ring-rose-500/20"
                          : "border-amber-brand/40")
                    : "border-border";
                  return (
                    <div key={i} className={`rounded-lg border bg-background/40 p-2.5 space-y-2 ${rowBorder}`}>
                      {/* Row 1: index badge + item name (full width) + validation + delete */}
                      <div className="flex items-center gap-2">
                        <span className="shrink-0 h-6 w-6 grid place-content-center rounded-md bg-neon/10 text-neon text-[10px] font-bold tabular-nums">
                          {i + 1}
                        </span>
                        <input
                          placeholder="שם פריט"
                          list="inventory-items-list"
                          value={row.item_name}
                          onChange={(e) => updateItem(i, "item_name", e.target.value)}
                          className="flex-1 min-w-0 h-10 rounded-md bg-background border border-border px-3 text-sm font-bold focus:border-neon outline-none"
                          dir="rtl"
                          autoComplete="off"
                        />
                        {trainingMode && (
                          <ValBtns
                            state={rowState}
                            onApprove={() => setIV(i, "approved")}
                            onReject={() => setIV(i, "corrected")}
                            size="md"
                          />
                        )}
                        <button
                          type="button"
                          onClick={() => removeItem(i)}
                          className="shrink-0 h-10 w-10 grid place-content-center rounded-md border border-border text-muted-foreground hover:border-destructive hover:text-destructive transition"
                          aria-label="מחק שורה"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      {/* Row 2: 5-col math grid — quantity · base · discount · net · total.
                          Base + discount are user-editable; net + total auto-recalc. */}
                      <div className="grid grid-cols-5 gap-1 min-w-0">
                        <div>
                          <label className="block text-[10px] font-bold text-muted-foreground mb-0.5 text-center">כמות</label>
                          <input
                            value={row.quantity}
                            onChange={(e) => updateItem(i, "quantity", e.target.value)}
                            className="w-full h-10 rounded-md bg-background border border-border px-1 text-sm text-center tabular-nums font-bold focus:border-neon outline-none"
                            inputMode="decimal"
                            placeholder="0"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-muted-foreground mb-0.5 text-center">מחיר בסיס</label>
                          <input
                            value={row.base_unit_price}
                            onChange={(e) => updateItem(i, "base_unit_price", e.target.value)}
                            className="w-full h-10 rounded-md bg-background border border-border px-1 text-sm text-center tabular-nums font-bold focus:border-neon outline-none"
                            inputMode="decimal"
                            placeholder="0.00"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-muted-foreground mb-0.5 text-center">הנחה</label>
                          <input
                            value={row.discount}
                            onChange={(e) => updateItem(i, "discount", e.target.value)}
                            className={`w-full h-10 rounded-md bg-background border px-1 text-xs text-center font-bold focus:border-neon outline-none ${hasDiscount ? "border-amber-brand/70 text-amber-brand" : "border-border text-muted-foreground"}`}
                            placeholder="—"
                            title='לדוגמה: "10%" או "5" או "₪5"'
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-muted-foreground mb-0.5 text-center">נטו ליח׳</label>
                          <div
                            className={`w-full h-10 rounded-md border bg-zinc-900/40 px-1 text-sm text-center tabular-nums font-bold flex items-center justify-center ${hasDiscount && netN > 0 ? "border-amber-brand/50 text-amber-brand" : "border-border/60 text-muted-foreground"}`}
                            title="מחושב אוטומטית מהבסיס וההנחה"
                          >
                            {netN > 0 ? netN.toFixed(2) : "—"}
                          </div>
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-muted-foreground mb-0.5 text-center">סה״כ ₪</label>
                          <div
                            className="w-full h-10 rounded-md border-2 border-border bg-zinc-900/40 px-1 text-sm text-center tabular-nums font-bold text-neon flex items-center justify-center"
                            title="מחושב: כמות × נטו ליחידה"
                          >
                            {totalN > 0 ? totalN.toFixed(2) : "—"}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>


            <div className="pt-3 border-t border-border space-y-2">
              {trainingMode && (
                <div className={`text-[11px] text-center font-bold tabular-nums px-3 py-2 rounded-md border ${
                  allValidated
                    ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-400"
                    : "border-amber-brand/50 bg-amber-brand/10 text-amber-brand"
                }`}>
                  {allValidated
                    ? "✓ כל השדות אומתו — אפשר לשמור וללמד"
                    : `נותרו ${pendingCount} שדות לאימות (סמן ✓ או ✗ לכל אחד)`}
                </div>
              )}
              {trainingMode && !allValidated && (
                <button
                  type="button"
                  onClick={() => {
                    setHeaderVal((p) => {
                      const next = { ...p };
                      (Object.keys(next) as HeaderKey[]).forEach((k) => {
                        if (next[k] === "pending") next[k] = "approved";
                      });
                      return next;
                    });
                    setItemVal((p) => p.map((s) => (s === "pending" ? "approved" : s)));
                  }}
                  className="w-full h-9 inline-flex items-center justify-center gap-2 rounded-md font-semibold text-xs border border-emerald-500/40 bg-emerald-500/5 text-emerald-400 hover:bg-emerald-500/15 transition"
                >
                  ✓ אשר הכל ({pendingCount})
                </button>
              )}
              <button
                type="button"
                onClick={handleConfirm}
                disabled={!formValid || submitting || (trainingMode && !allValidated)}
                className="w-full h-11 inline-flex items-center justify-center gap-2 rounded-md font-bold text-white transition disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: "linear-gradient(135deg, #ff2db4, #ff5ec0)", boxShadow: "0 0 20px rgba(255,45,180,0.45)" }}
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {trainingMode ? "שמור ולמד" : isEdit ? "שמור שינויים" : "אשר קליטה"}
              </button>
              {!formValid && (
                <p className="text-[11px] text-muted-foreground mt-1.5 text-center">
                  יש למלא ספק, סכום כולל ותאריך כדי להמשיך.
                </p>
              )}
              {isEdit && editInvoice && (
                <div className="flex justify-start pt-1">
                  <ModalDeleteButton
                    title="מחיקת חשבונית"
                    description="האם למחוק פריט זה לצמיתות?"
                    onConfirm={async () => {
                      await supabase.from("invoice_items").delete().eq("invoice_id", editInvoice.id);
                      const { error } = await supabase.from("invoices").delete().eq("id", editInvoice.id);
                      if (error) {
                        toast.error(error.message);
                        throw error;
                      }
                      toast.success("החשבונית נמחקה בהצלחה");
                      onDeleted?.(editInvoice.id);
                      onClose();
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {showAnomaly && (
          <div className="fixed inset-0 z-[60] bg-background/85 backdrop-blur-sm grid place-items-center p-4" dir="rtl">
            <div className="w-full max-w-md bg-card border-2 border-amber-brand rounded-2xl p-5 space-y-3">
              <div className="flex items-center gap-2 font-bold text-amber-brand">
                <AlertTriangle className="h-5 w-5" />
                שים לב: הסכום שהוזן גבוה מהרגיל
              </div>
              <p className="text-sm text-muted-foreground">
                הסכום ₪{(totalNum ?? 0).toLocaleString("he-IL")} חורג מהממוצע ההיסטורי של הספק או עובר את התקרה. האם ברצונך להמשיך?
              </p>
              <div className="flex gap-2 pt-1">
                <button onClick={() => { setShowAnomaly(false); doSubmit(); }} className="flex-1 h-10 rounded-md bg-neon text-primary-foreground font-bold">אישור</button>
                <button onClick={() => setShowAnomaly(false)} className="flex-1 h-10 rounded-md border border-border font-bold hover:border-neon">חזור לעריכה</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
