import { useEffect, useMemo, useRef, useState } from "react";
import { X, Upload, Loader2, CheckCircle2, AlertTriangle, ScanSearch, Link2, Check } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { requireCurrentBranchId } from "@/lib/current-branch";
import { parseInvoiceImage, learnFromCorrection } from "@/lib/invoice-ocr.functions";
import { receivingHeaderSchema, validateOrToast } from "@/lib/schemas";


export const EXPENSE_CATEGORIES = [
  "חומרי גלם",
  "ניקיון ותחזוקה",
  "אריזה וחד־פעמי",
  "משקאות",
  "אחר",
] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];



interface SupplierOpt { id: string; name: string }
interface Props {
  suppliers: SupplierOpt[];
  onClose: () => void;
  onSaved: () => void;
  linkedOrderId?: string | null;
}

type OrderItem = { name: string; qty: string };
type Match = {
  order_id: string;
  supplier_id: string;
  supplier_name: string;
  sent_at: string;
  items: OrderItem[];
  score: number;
};
type OcrItem = { name: string; quantity: number; unit_price?: number; total_price?: number };
type Parsed = {
  supplier_name_hint: string | null;
  invoice_number: string | null;
  total_amount: number | null;
  document_date: string | null;
  items: OcrItem[];
};
type NotReceivedReason = "missing" | "damaged";
type RowPair = {
  name: string;
  orderedQty: number | null;
  invoiceQty: number;
  unitPrice: number;
  totalPrice: number;
  category: ExpenseCategory | "";
  // === Catalog matching (Receipt Intelligence) ===
  catalogProductId: string | null;
  catalogCostPrice: number | null;
  matchSimilarity: number | null;
  aiSuggestedProductId: string | null;
  matchStatus: "auto" | "review" | "manual" | "new" | "none";
  // === Physical delivery verification (independent of AI feedback) ===
  received: boolean;
  notReceivedReason: NotReceivedReason | null;
};

type CatalogOpt = {
  id: string;
  name: string;
  cost_price: number | null;
  expected_price: number | null;
  price: number | null;
  sku: string | null;
  unit: string | null;
  unit_size: string | null;
  barcode: string | null;
};

type Stage = "pick" | "processing" | "suggest" | "verify" | "manual";


const fileToDataUrl = (file: File): Promise<string> => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(String(r.result || ""));
  r.onerror = reject;
  r.readAsDataURL(file);
});

// Compress a data URL via off-screen canvas (max 1920px longest side, JPEG q=0.82).
// Skips compression for inputs already under ~800KB to avoid needless work.
async function compressImage(dataUrl: string): Promise<string> {
  try {
    // Approximate byte size of the base64 payload.
    const b64 = dataUrl.split(",")[1] ?? "";
    const approxBytes = Math.floor((b64.length * 3) / 4);
    if (approxBytes < 800 * 1024) return dataUrl;
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = dataUrl;
    });
    const maxSide = 1920;
    const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return dataUrl;
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL("image/jpeg", 0.82);
  } catch {
    return dataUrl;
  }
}
const blankMatch = (): Pick<RowPair, "catalogProductId" | "catalogCostPrice" | "matchSimilarity" | "aiSuggestedProductId" | "matchStatus" | "received" | "notReceivedReason"> => ({
  catalogProductId: null,
  catalogCostPrice: null,
  matchSimilarity: null,
  aiSuggestedProductId: null,
  matchStatus: "none",
  received: true,
  notReceivedReason: null,
});


const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
const looseEq = (a: string, b: string) => {
  const x = norm(a), y = norm(b);
  if (!x || !y) return false;
  return x === y || x.includes(y) || y.includes(x);
};

export function SmartReceivingModal({ suppliers, onClose, onSaved, linkedOrderId = null }: Props) {
  const ocr = useServerFn(parseInvoiceImage);
  const runLearn = useServerFn(learnFromCorrection);
  const [stage, setStage] = useState<Stage>("pick");
  const [supplierId, setSupplierId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [chosenMatch, setChosenMatch] = useState<Match | null>(null);
  const [catalog, setCatalog] = useState<CatalogOpt[]>([]);
  const [estimatedTotalOverride, setEstimatedTotalOverride] = useState<string>("");
  const [rows, setRows] = useState<RowPair[]>([]);
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [docDate, setDocDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [submitting, setSubmitting] = useState(false);
  const [categoryMemory, setCategoryMemory] = useState<Map<string, ExpenseCategory>>(new Map());
  const fileInput = useRef<HTMLInputElement>(null);

  // ============================================================
  // Gamified per-field feedback (V / X) — same model as AI Training Sandbox.
  // Only meaningful when OCR ran (parsed != null). When user keeps the AI's
  // value and clicks ✓, it's "approved" (XP boost). Clicking ✗ or editing the
  // field flips it to "corrected" (the model learns from the diff).
  // ============================================================
  type ValState = "pending" | "approved" | "corrected";
  type HeaderKey = "invoice_number" | "document_date" | "total_amount";
  const [headerVal, setHeaderVal] = useState<Record<HeaderKey, ValState>>({
    invoice_number: "pending",
    document_date: "pending",
    total_amount: "pending",
  });
  const [itemVal, setItemVal] = useState<ValState[]>([]);
  const setHV = (k: HeaderKey, v: ValState) => setHeaderVal((p) => ({ ...p, [k]: v }));
  const setIV = (i: number, v: ValState) =>
    setItemVal((p) => {
      const next = p.length > i ? [...p] : [...p, ...Array.from({ length: i + 1 - p.length }, () => "pending" as ValState)];
      next[i] = v;
      return next;
    });
  const markHeaderEdited = (k: HeaderKey) => {
    setHeaderVal((p) => (p[k] === "pending" ? { ...p, [k]: "corrected" } : p));
  };
  const markItemEdited = (i: number) => {
    setItemVal((p) => p.map((s, idx) => (idx === i && s === "pending" ? "corrected" : s)));
  };
  const resetValidation = (rowCount: number) => {
    setHeaderVal({ invoice_number: "pending", document_date: "pending", total_amount: "pending" });
    setItemVal(Array.from({ length: Math.max(0, rowCount) }, () => "pending" as ValState));
  };
  // Keep itemVal length in sync when rows are added/removed.
  useEffect(() => {
    setItemVal((p) => {
      if (p.length === rows.length) return p;
      if (p.length < rows.length) return [...p, ...Array.from({ length: rows.length - p.length }, () => "pending" as ValState)];
      return p.slice(0, rows.length);
    });
  }, [rows.length]);
  // Show V/X feedback whenever there is something to review (OCR result OR uploaded
  // file OR rows the user can grade). This keeps the learning loop alive even when
  // OCR didn't populate `parsed` (manual edits, retried scan, fallback parser, etc.).
  const aiActive = parsed != null || !!file || !!previewUrl || rows.length > 0;
  const approvedCount = useMemo(() => {
    const h = (Object.values(headerVal) as ValState[]).filter((s) => s === "approved").length;
    const it = itemVal.filter((s) => s === "approved").length;
    return h + it;
  }, [headerVal, itemVal]);
  const correctedCount = useMemo(() => {
    const h = (Object.values(headerVal) as ValState[]).filter((s) => s === "corrected").length;
    const it = itemVal.filter((s) => s === "corrected").length;
    return h + it;
  }, [headerVal, itemVal]);
  const pendingCount = useMemo(() => {
    const h = (Object.values(headerVal) as ValState[]).filter((s) => s === "pending").length;
    const it = itemVal.filter((s) => s === "pending").length;
    return h + it;
  }, [headerVal, itemVal]);


  // Load category dictionary (item name → category) for the current branch
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("ai_learning_dictionary")
        .select("user_input, resolved_intent")
        .eq("context", "invoice_category")
        .order("created_at", { ascending: false })
        .limit(500);
      if (cancelled || !data) return;
      const map = new Map<string, ExpenseCategory>();
      for (const r of data as Array<{ user_input: string; resolved_intent: { category?: string } }>) {
        const cat = r.resolved_intent?.category as ExpenseCategory | undefined;
        const k = norm(r.user_input);
        if (cat && k && !map.has(k) && (EXPENSE_CATEGORIES as readonly string[]).includes(cat)) {
          map.set(k, cat);
        }
      }
      setCategoryMemory(map);
    })();
    return () => { cancelled = true; };
  }, []);

  // === Load supplier catalog for matching dropdowns + cost-based estimates ===
  useEffect(() => {
    if (!supplierId) { setCatalog([]); return; }
    let cancelled = false;
    (async () => {
      const branchId = await requireCurrentBranchId();
      const { data } = await supabase
        .from("supplier_products")
        .select("id, name, cost_price, expected_price, price, sku, unit, unit_size, barcode")
        .eq("supplier_id", supplierId)
        .eq("branch_id", branchId)
        .eq("active", true)
        .order("name", { ascending: true });
      if (cancelled) return;
      setCatalog(((data ?? []) as CatalogOpt[]));
    })();
    return () => { cancelled = true; };
  }, [supplierId]);

  /**
   * Fuzzy-match each row against the supplier catalog. Returns a NEW rows
   * array with matchStatus populated:
   *   auto    — similarity >= 0.85 (high confidence)
   *   review  — 0 < similarity < 0.85 (low confidence, needs human review)
   *   none    — no candidate at all
   */
  const matchRowsAgainstCatalog = async (input: RowPair[]): Promise<RowPair[]> => {
    if (!supplierId) return input;
    const branchId = await requireCurrentBranchId();
    const out = await Promise.all(input.map(async (r) => {
      if (r.matchStatus === "manual" || r.matchStatus === "new") return r;
      if (!r.name.trim()) return r;
      try {
        const { data } = await supabase.rpc("find_catalog_match", {
          _branch_id: branchId,
          _supplier_id: supplierId,
          _query: r.name.trim(),
        });
        const best = (data ?? [])[0] as { product_id: string; product_name: string; similarity: number } | undefined;
        if (!best || best.similarity <= 0) {
          return { ...r, matchStatus: "none" as const, catalogProductId: null, matchSimilarity: 0, aiSuggestedProductId: null };
        }
        const catItem = catalog.find((c) => c.id === best.product_id);
        const cost = catItem?.cost_price ?? catItem?.expected_price ?? catItem?.price ?? null;
        const status = best.similarity >= 0.85 ? "auto" as const : "review" as const;
        return {
          ...r,
          matchStatus: status,
          catalogProductId: best.product_id,
          catalogCostPrice: cost,
          matchSimilarity: best.similarity,
          aiSuggestedProductId: best.product_id,
        };
      } catch {
        return r;
      }
    }));
    return out;
  };

  // Auto-run catalog matching once for any row that hasn't been classified yet.
  // (Skips rows already manually chosen or marked as "new product").
  useEffect(() => {
    if (stage !== "verify" && stage !== "manual") return;
    if (!supplierId) return;
    const needs = rows.some((r) => r.matchSimilarity == null && r.matchStatus === "none" && r.name.trim());
    if (!needs) return;
    let cancelled = false;
    (async () => {
      const next = await matchRowsAgainstCatalog(rows);
      if (!cancelled) setRows(next);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, supplierId, catalog.length, rows.length]);





  const lookupCategory = (name: string): ExpenseCategory | "" => {
    const k = norm(name);
    if (!k) return "";
    if (categoryMemory.has(k)) return categoryMemory.get(k)!;
    // loose match
    for (const [key, val] of categoryMemory) {
      if (key.includes(k) || k.includes(key)) return val;
    }
    return "";
  };


  // Preload the linked order (when receiving was launched contextually)
  useEffect(() => {
    if (!linkedOrderId) return;
    let cancelled = false;
    (async () => {
      const { data: order } = await supabase
        .from("orders")
        .select("id, supplier_id, sent_at, items, suppliers:supplier_id(name)")
        .eq("id", linkedOrderId)
        .maybeSingle();
      if (cancelled || !order) return;
      const items = (Array.isArray(order.items) ? order.items : []) as Array<{ name?: string; qty?: string }>;
      const supplierName = (order as { suppliers?: { name?: string } }).suppliers?.name
        ?? suppliers.find((s) => s.id === order.supplier_id)?.name
        ?? "";
      const match: Match = {
        order_id: order.id,
        supplier_id: order.supplier_id,
        supplier_name: supplierName,
        sent_at: order.sent_at,
        items: items.map((i) => ({ name: String(i.name ?? ""), qty: String(i.qty ?? "") })),
        score: 1,
      };
      setSupplierId(order.supplier_id);
      setChosenMatch(match);
      setMatches([match]);
    })();
    return () => { cancelled = true; };
  }, [linkedOrderId, suppliers]);

  useEffect(() => () => { if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl); }, [previewUrl]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const onFile = async (f: File | null) => {
    setFile(f);
    if (!f) {
      setPreviewUrl(null);
      return;
    }
    const dataUrl = await fileToDataUrl(f);
    setPreviewUrl(dataUrl);
    toast.success("התמונה נקלטה, מתחיל פענוח…");
    await start(f, dataUrl);
  };

  const start = async (selectedFile: File | null = file, dataUrlOverride?: string) => {
    const targetFile = selectedFile ?? file;
    if (!targetFile) return toast.error("יש להעלות תמונת חשבונית");
    setStage("processing");
    try {
      const dataUrl = dataUrlOverride ?? await fileToDataUrl(targetFile);
      const catalogPayload = catalog.slice(0, 200).map((p) => ({
        name: p.name,
        sku: p.sku ?? null,
        unit: p.unit ?? null,
        unit_size: p.unit_size ?? null,
        price: p.cost_price ?? p.expected_price ?? p.price ?? null,
        barcode: p.barcode ?? null,
      }));
      const raw = await ocr({
        data: {
          imageDataUrl: dataUrl,
          mimeType: targetFile.type || "image/jpeg",
          supplierId: supplierId || undefined,
          supplierCatalog: catalogPayload.length ? catalogPayload : undefined,
        },
      });
      const normalizedParsed: Parsed = {
        supplier_name_hint: raw.supplier_guess ?? null,
        invoice_number: raw.invoice_number ?? null,
        total_amount: raw.total_amount ?? null,
        document_date: raw.document_date ?? null,
        items: (raw.items ?? [])
          .map((it) => {
            const quantity = Number(it.quantity ?? 0) || 0;
            const total = it.total_price ?? undefined;
            const unit = it.unit_price ?? it.base_unit_price ?? (quantity > 0 && total != null ? total / quantity : undefined);
            return {
              name: String(it.item_name ?? "").trim(),
              quantity,
              unit_price: unit,
              total_price: total,
            };
          })
          .filter((it) => it.name.length > 0),
      };
      setParsed(normalizedParsed);

      let effectiveSupplierId = supplierId;
      if (!effectiveSupplierId && normalizedParsed.supplier_name_hint) {
        const guess = normalizedParsed.supplier_name_hint.trim().toLowerCase();
        const match = suppliers.find((s) => s.name.toLowerCase().includes(guess) || guess.includes(s.name.toLowerCase()));
        if (match) {
          effectiveSupplierId = match.id;
          setSupplierId(match.id);
        }
      }

      const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
      let query = supabase
        .from("orders")
        .select("id, supplier_id, sent_at, items, status")
        .eq("status", "sent")
        .gte("sent_at", cutoff)
        .order("sent_at", { ascending: false })
        .limit(15);
      if (effectiveSupplierId) query = query.eq("supplier_id", effectiveSupplierId);
      const { data: orders } = await query;
      const supplierIds = Array.from(new Set((orders ?? []).map((o) => o.supplier_id).filter(Boolean)));
      let supplierMap: Record<string, string> = {};
      if (supplierIds.length) {
        const { data: sups } = await supabase.from("suppliers").select("id, name").in("id", supplierIds);
        supplierMap = Object.fromEntries((sups ?? []).map((s) => [s.id, s.name]));
      }
      const hint = (normalizedParsed.supplier_name_hint ?? "").toLowerCase().trim();
      const nextMatches = (orders ?? []).map((o) => {
        const supName = supplierMap[o.supplier_id] ?? "";
        let score = 0;
        if (effectiveSupplierId && o.supplier_id === effectiveSupplierId) score += 50;
        if (hint && supName && (supName.toLowerCase().includes(hint) || hint.includes(supName.toLowerCase()))) score += 30;
        const ageHrs = (Date.now() - new Date(o.sent_at).getTime()) / 3_600_000;
        score += Math.max(0, 20 - ageHrs);
        return {
          order_id: o.id as string,
          supplier_id: o.supplier_id as string,
          supplier_name: supName,
          sent_at: o.sent_at as string,
          items: (o.items ?? []) as Array<{ name: string; qty: string }>,
          score,
        };
      }).sort((a, b) => b.score - a.score);
      setMatches(nextMatches);
      if (normalizedParsed.invoice_number) setInvoiceNumber(normalizedParsed.invoice_number);
      if (normalizedParsed.total_amount != null) setTotalAmount(String(normalizedParsed.total_amount));
      if (normalizedParsed.document_date) setDocDate(normalizedParsed.document_date);
      // If contextually linked to a specific order, auto-link and jump to verify
      if (linkedOrderId && chosenMatch) {
        linkToMatch(chosenMatch, normalizedParsed);
        return;
      }
      if (nextMatches.length > 0) setStage("suggest");
      else skipMatch(normalizedParsed);
    } catch (e) {
      console.error(e);
      const msg = e instanceof Error ? e.message : String(e);
      toast.error("ניתוח החשבונית נכשל", { description: msg.slice(0, 240) });
      setStage("pick");
    }
  };

  const linkToMatch = (m: Match, sourceParsed: Parsed | null = parsed) => {
    setChosenMatch(m);
    setSupplierId(m.supplier_id);
    const ocrItems = sourceParsed?.items ?? [];
    const used = new Set<number>();
    const pairs: RowPair[] = m.items.map((oi) => {
      const orderedQty = Number(oi.qty.replace(/[^\d.]/g, "")) || null;
      // try to find matching invoice item
      const idx = ocrItems.findIndex((it, i) => !used.has(i) && looseEq(it.name, oi.name));
      let invQty = 0; let up = 0; let tp = 0;
      if (idx >= 0) {
        used.add(idx);
        invQty = Number(ocrItems[idx].quantity) || 0;
        up = Number(ocrItems[idx].unit_price) || 0;
        tp = Number(ocrItems[idx].total_price) || invQty * up;
      }
      return { name: oi.name, orderedQty, invoiceQty: invQty, unitPrice: up, totalPrice: tp, category: lookupCategory(oi.name), ...blankMatch() };
    });
    // Extra invoice items not on the order
    ocrItems.forEach((it, i) => {
      if (used.has(i)) return;
      pairs.push({
        name: it.name, orderedQty: null,
        invoiceQty: Number(it.quantity) || 0,
        unitPrice: Number(it.unit_price) || 0,
        totalPrice: Number(it.total_price) || 0,
        category: lookupCategory(it.name),
        ...blankMatch(),
      });

    });
    setRows(pairs);
    resetValidation(pairs.length);
    setStage("verify");
  };

  const skipMatch = (sourceParsed: Parsed | null = parsed) => {
    // populate rows from OCR only
    const ocrItems = sourceParsed?.items ?? [];
    const newRows: RowPair[] = ocrItems.map((it) => ({
      name: it.name, orderedQty: null,
      invoiceQty: Number(it.quantity) || 0,
      unitPrice: Number(it.unit_price) || 0,
      totalPrice: Number(it.total_price) || 0,
      category: lookupCategory(it.name) as ExpenseCategory | "",
      ...blankMatch(),
    }));
    setRows(newRows);
    resetValidation(newRows.length);
    setStage("manual");
  };


  const totalNum = Number(totalAmount);
  const canSubmit = supplierId && !Number.isNaN(totalNum) && totalNum > 0 && docDate && !submitting;

  const submit = async () => {
    if (!canSubmit) return;
    const validatedHeader = validateOrToast(receivingHeaderSchema, {
      supplier_id: supplierId,
      invoice_number: invoiceNumber,
      document_date: docDate,
      total_amount: totalNum,
    });
    if (!validatedHeader) return;
    setSubmitting(true);
    try {
      const branchId = await requireCurrentBranchId();
      let path: string | null = null;
      if (file) {
        const now = new Date();
        const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
        const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase();
        path = `${supplierId}/${ym}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error: upErr } = await supabase.storage.from("invoice-images").upload(path, file, {
          contentType: file.type || "image/jpeg",
          upsert: false,
        });
        if (upErr) throw upErr;
      }

      const { data: invoiceRow, error } = await supabase
        .from("invoices")
        .insert({
          branch_id: branchId,
          supplier_id: supplierId,
          invoice_number: invoiceNumber.trim(),
          total_amount: totalNum,
          document_date: docDate,
          image_url: path,
          invoice_image_url: path,
          order_id: chosenMatch?.order_id ?? null,
          status: "approved",
        })
        .select("id")
        .single();
      if (error) throw error;


      // Invoice items (with financial category)
      const cleanItems = rows.filter((r) => r.name.trim());
      if (cleanItems.length && invoiceRow) {
        await supabase.from("invoice_items").insert(cleanItems.map((r, idx) => ({
          invoice_id: invoiceRow.id,
          item_name: r.name.slice(0, 200),
          quantity: r.invoiceQty,
          unit_price: r.unitPrice,
          total_price: r.totalPrice || r.invoiceQty * r.unitPrice,
          category: r.category || null,
          sort_order: idx,
        })));
      }

      // === AI MEMORY: persist item→category mappings ===
      const newMappings = cleanItems.filter((r) => r.category && lookupCategory(r.name) !== r.category);
      if (newMappings.length) {
        await supabase.from("ai_learning_dictionary").insert(newMappings.map((r) => ({
          branch_id: branchId,
          context: "invoice_category",
          user_input: r.name.trim().slice(0, 200),
          ai_suggestion: {},
          resolved_intent: { category: r.category },
        })));
      }

      // === GAMIFICATION: OCR feedback row for XP/streak tracking ===
      // Source-of-truth = explicit user feedback (V ✓ / X ✗) collected per field.
      // Falls back to diff against parsed OCR for any field the user didn't tag.
      const numEq = (a: number | null | undefined, b: number | null | undefined) =>
        Math.abs((Number(a) || 0) - (Number(b) || 0)) < 0.01;
      let approved = 0;
      let edits = 0;
      if (parsed) {
        // Header — explicit state wins; pending => fallback to diff.
        const headerFallback: Record<HeaderKey, boolean> = {
          invoice_number: (parsed.invoice_number ?? "").trim() === invoiceNumber.trim(),
          total_amount: numEq(parsed.total_amount, totalNum),
          document_date: (parsed.document_date ?? "") === docDate,
        };
        (Object.keys(headerVal) as HeaderKey[]).forEach((k) => {
          const s = headerVal[k];
          if (s === "approved") approved++;
          else if (s === "corrected") edits++;
          else if (headerFallback[k]) approved++;
          else edits++;
        });
        // Items — explicit state wins; pending => fallback to OCR diff.
        // CRITICAL: rows the user marked as "not received" are PHYSICAL delivery
        // issues, not OCR errors. Never let them implicitly count as a negative
        // AI signal — skip them entirely from the parsing-accuracy fallback.
        const ocrItems = parsed.items ?? [];
        cleanItems.forEach((r, idx) => {
          const s = itemVal[idx] ?? "pending";
          if (s === "approved") { approved++; return; }
          if (s === "corrected") { edits++; return; }
          if (!r.received) return; // discrepancy, not OCR feedback
          const match = ocrItems.find((it) => looseEq(it.name, r.name));
          if (!match) { edits++; return; }
          if (!numEq(match.quantity, r.invoiceQty) || !numEq(match.unit_price, r.unitPrice)) edits++;
          else approved++;
        });
      }
      const isPerfect = parsed != null && edits === 0 && approved > 0;
      // Delivery-accuracy metrics — independent of AI parsing accuracy.
      const deliveryTotal = cleanItems.length;
      const deliveryReceived = cleanItems.filter((r) => r.received).length;
      const deliveryIssues = cleanItems
        .filter((r) => !r.received)
        .map((r) => ({ name: r.name, reason: r.notReceivedReason ?? "missing", quantity: r.invoiceQty }));
      await supabase.from("invoice_ocr_feedback").insert({
        branch_id: branchId,
        supplier_id: supplierId,
        invoice_id: invoiceRow!.id,
        raw_ocr: (parsed as unknown) as never,
        final_data: {
          invoice_number: invoiceNumber.trim(),
          total_amount: totalNum,
          document_date: docDate,
          items: cleanItems.map((r, idx) => ({
            name: r.name, quantity: r.invoiceQty, unit_price: r.unitPrice, category: r.category,
            _val: itemVal[idx] ?? "pending",
            _received: r.received,
            _not_received_reason: r.notReceivedReason,
          })),
          _validation: { header: headerVal, approved, corrected: edits },
          _delivery: { total: deliveryTotal, received: deliveryReceived, issues: deliveryIssues },
        },
        diff_summary: isPerfect ? "perfect" : `edits:${edits}`,
      });




      // Mark order received + update inventory
      if (chosenMatch) {
        await supabase
          .from("orders")
          .update({ status: "received", received_at: new Date().toISOString(), invoice_id: invoiceRow!.id })
          .eq("id", chosenMatch.order_id);
      }

      // === CATALOG SYNC + MAPPING-CORRECTIONS LEARNING LOOP ===
      // For each parsed row:
      //   - if user picked a catalog product (matchStatus === "manual") use that id directly
      //   - if user marked "new" we always create
      //   - otherwise we keep the prior auto/fuzzy logic
      //   - every time the final productId differs from the AI's initial suggestion
      //     (or AI had none and user picked one) we store a mapping_correction row
      //     so future matching can be biased by past human decisions.
      const priceAlerts: Array<{ name: string; oldPrice: number; newPrice: number; pct: number }> = [];
      const catalogIdByName = new Map<string, string>();
      const mappingCorrections: Array<{
        parsed_text: string; corrected_product_id: string | null;
        ai_suggested_product_id: string | null; ai_similarity: number | null; match_action: string;
      }> = [];

      // Helper: build a short Hebrew price-change note and prepend to existing notes
      const buildPriceNote = (oldP: number, newP: number): string => {
        const today = new Date().toLocaleDateString("he-IL");
        const dir = newP > oldP ? "↑ עלייה" : "↓ ירידה";
        const pct = oldP > 0 ? Math.round(((newP - oldP) / oldP) * 100) : 0;
        return `[${today}] ${dir} במחיר: ${oldP.toFixed(2)} → ${newP.toFixed(2)} ₪ (${pct > 0 ? "+" : ""}${pct}%)`;
      };
      const mergeNotes = (existing: string | null | undefined, line: string): string => {
        const prev = (existing ?? "").trim();
        // Keep only last ~5 price-change lines to avoid unbounded growth
        const lines = prev ? prev.split("\n") : [];
        lines.unshift(line);
        return lines.slice(0, 8).join("\n");
      };

      if (supplierId) {
        for (const r of cleanItems) {
          if (!r.name.trim()) continue;
          const cleanName = r.name.trim().slice(0, 200);
          let productId: string | null = null;
          let previousPrice: number | null = null;

          if (r.matchStatus === "manual" && r.catalogProductId) {
            productId = r.catalogProductId;
            const { data: existing } = await supabase
              .from("supplier_products")
              .select("price, expected_price, cost_price, notes")
              .eq("id", productId)
              .maybeSingle();
            previousPrice = Number(existing?.cost_price ?? existing?.expected_price ?? existing?.price ?? 0) || null;
            if (r.unitPrice > 0) {
              const priceChanged = previousPrice != null && Math.abs(previousPrice - r.unitPrice) > 0.001;
              await supabase
                .from("supplier_products")
                .update({
                  price: r.unitPrice,
                  expected_price: existing?.expected_price ?? r.unitPrice,
                  cost_price: r.unitPrice,
                  notes: priceChanged
                    ? mergeNotes(existing?.notes, buildPriceNote(previousPrice!, r.unitPrice))
                    : existing?.notes ?? null,
                })
                .eq("id", productId);
            }
          } else if (r.matchStatus === "new") {
            const { data: created } = await supabase
              .from("supplier_products")
              .insert({
                supplier_id: supplierId,
                branch_id: branchId,
                name: cleanName,
                unit: "",
                default_qty: r.invoiceQty || 1,
                price: r.unitPrice || null,
                expected_price: r.unitPrice || null,
                cost_price: r.unitPrice || null,
                category: r.category || null,
                active: true,
              })
              .select("id")
              .maybeSingle();
            productId = created?.id ?? null;
          } else if (r.catalogProductId && (r.matchStatus === "auto" || r.matchStatus === "review")) {
            productId = r.catalogProductId;
            const { data: existing } = await supabase
              .from("supplier_products")
              .select("price, expected_price, cost_price, notes")
              .eq("id", productId)
              .maybeSingle();
            previousPrice = Number(existing?.cost_price ?? existing?.expected_price ?? existing?.price ?? 0) || null;
            if (r.unitPrice > 0) {
              const priceChanged = previousPrice != null && Math.abs(previousPrice - r.unitPrice) > 0.001;
              await supabase
                .from("supplier_products")
                .update({
                  price: r.unitPrice,
                  expected_price: existing?.expected_price ?? r.unitPrice,
                  cost_price: r.unitPrice,
                  notes: priceChanged
                    ? mergeNotes(existing?.notes, buildPriceNote(previousPrice!, r.unitPrice))
                    : existing?.notes ?? null,
                })
                .eq("id", productId);
            }
          } else if (r.unitPrice > 0) {
            // Last-resort fuzzy fallback (no client-side match attached)
            const { data: matches } = await supabase.rpc("find_catalog_match", {
              _branch_id: branchId, _supplier_id: supplierId, _query: cleanName,
            });
            const best = (matches ?? [])[0] as
              | { product_id: string; product_name: string; similarity: number; match_type: string }
              | undefined;
            if (best && best.similarity >= 0.6) {
              productId = best.product_id;
              const { data: existing } = await supabase
                .from("supplier_products")
                .select("price, expected_price, cost_price, notes")
                .eq("id", productId)
                .maybeSingle();
              previousPrice = Number(existing?.cost_price ?? existing?.expected_price ?? existing?.price ?? 0) || null;
              const priceChanged = previousPrice != null && Math.abs(previousPrice - r.unitPrice) > 0.001;
              await supabase
                .from("supplier_products")
                .update({
                  price: r.unitPrice,
                  expected_price: existing?.expected_price ?? r.unitPrice,
                  cost_price: r.unitPrice,
                  notes: priceChanged
                    ? mergeNotes(existing?.notes, buildPriceNote(previousPrice!, r.unitPrice))
                    : existing?.notes ?? null,
                })
                .eq("id", productId);
            } else {
              const { data: created } = await supabase
                .from("supplier_products")
                .insert({
                  supplier_id: supplierId,
                  branch_id: branchId,
                  name: cleanName,
                  unit: "",
                  default_qty: r.invoiceQty || 1,
                  price: r.unitPrice,
                  expected_price: r.unitPrice,
                  cost_price: r.unitPrice,
                  category: r.category || null,
                  active: true,
                })
                .select("id")
                .maybeSingle();
              productId = created?.id ?? null;
            }
          }

          if (productId) catalogIdByName.set(cleanName, productId);

          // === Mapping correction: only when human input diverged from AI ===
          const aiSuggestion = r.aiSuggestedProductId ?? null;
          if (r.matchStatus === "manual" && productId && productId !== aiSuggestion) {
            mappingCorrections.push({
              parsed_text: cleanName,
              corrected_product_id: productId,
              ai_suggested_product_id: aiSuggestion,
              ai_similarity: r.matchSimilarity,
              match_action: "remap",
            });
          } else if (r.matchStatus === "new" && productId) {
            mappingCorrections.push({
              parsed_text: cleanName,
              corrected_product_id: productId,
              ai_suggested_product_id: aiSuggestion,
              ai_similarity: r.matchSimilarity,
              match_action: "new_product",
            });
          }

          // Flag significant price change (>=10% delta vs cost baseline) for toast alert
          if (previousPrice && previousPrice > 0 && r.unitPrice > 0) {
            const pct = ((r.unitPrice - previousPrice) / previousPrice) * 100;
            if (Math.abs(pct) >= 10) {
              priceAlerts.push({ name: cleanName, oldPrice: previousPrice, newPrice: r.unitPrice, pct });
            }
          }
        }


        // Persist all corrections as training data for future matches.
        if (mappingCorrections.length) {
          await supabase.from("mapping_corrections").insert(mappingCorrections.map((m) => ({
            branch_id: branchId,
            supplier_id: supplierId,
            invoice_id: invoiceRow!.id,
            parsed_text: m.parsed_text,
            corrected_product_id: m.corrected_product_id,
            ai_suggested_product_id: m.ai_suggested_product_id,
            ai_similarity: m.ai_similarity,
            match_action: m.match_action,
          })));
        }
      }


      // Inventory: upsert items + insert movements per RECEIVED row.
      // Rows marked "not received" are recorded as discrepancies (shortage_items)
      // and never touch inventory or AI feedback.
      const discrepancyRows: Array<{ name: string; reason: NotReceivedReason; quantity: number; catalogId: string | null }> = [];
      for (const r of cleanItems) {
        const name = r.name.trim().slice(0, 200);
        if (!r.received) {
          discrepancyRows.push({
            name,
            reason: r.notReceivedReason ?? "missing",
            quantity: r.orderedQty ?? r.invoiceQty ?? 0,
            catalogId: catalogIdByName.get(name) ?? r.catalogProductId ?? null,
          });
          continue;
        }
        if (r.invoiceQty <= 0) continue;
        let invId: string | null = null;
        const { data: existing } = await supabase
          .from("inventory_items")
          .select("id, current_stock")
          .eq("branch_id", branchId)
          .eq("name", name)
          .maybeSingle();
        if (existing) {
          invId = existing.id;
          await supabase
            .from("inventory_items")
            .update({ current_stock: Number(existing.current_stock || 0) + r.invoiceQty })
            .eq("id", existing.id);
        } else {
          const { data: created } = await supabase
            .from("inventory_items")
            .insert({ branch_id: branchId, name, unit: "", current_stock: r.invoiceQty })
            .select("id")
            .single();
          invId = created?.id ?? null;
        }
        if (invId) {
          await supabase.from("inventory_movements").insert({
            branch_id: branchId,
            inventory_item_id: invId,
            qty_delta: r.invoiceQty,
            source: chosenMatch ? "order_received" : "manual",
            order_id: chosenMatch?.order_id ?? null,
            invoice_id: invoiceRow!.id,
            note: chosenMatch ? `התקבל מהזמנה #${chosenMatch.order_id.slice(0, 8)}` : "קליטה ידנית",
          });
        }
      }

      // Discrepancy report — open shortage tickets for the missing/damaged items.
      if (discrepancyRows.length) {
        const reasonLabel: Record<NotReceivedReason, string> = { missing: "חסר במשלוח", damaged: "פגום / לא תקין" };
        await supabase.from("shortage_items").insert(discrepancyRows.map((d) => ({
          branch_id: branchId,
          name: d.name,
          quantity: d.quantity,
          unit: "",
          notes: `${reasonLabel[d.reason]} · חשבונית ${invoiceNumber.trim() || invoiceRow!.id.slice(0, 8)} · ${supplierName || "ספק"}`,
          catalog_item_id: d.catalogId,
          status: "open",
        })));
        toast.warning(`📋 נפתח דוח חריגות עבור ${discrepancyRows.length} פריט(ים) שלא הגיעו`, { duration: 7000 });
      }

      // Surface price-change alerts so the manager sees them right after save
      if (priceAlerts.length) {
        const top = priceAlerts.slice(0, 3).map((a) => {
          const arrow = a.pct > 0 ? "📈" : "📉";
          return `${arrow} ${a.name}: ₪${a.oldPrice.toFixed(2)} → ₪${a.newPrice.toFixed(2)} (${a.pct > 0 ? "+" : ""}${a.pct.toFixed(0)}%)`;
        }).join("\n");
        const more = priceAlerts.length > 3 ? `\n+${priceAlerts.length - 3} פריטים נוספים` : "";
        toast.warning(`⚠️ זוהו שינויי מחיר משמעותיים:\n${top}${more}`, { duration: 10000 });
      }

      toast.success("החשבונית נקלטה והמלאי עודכן");
      onSaved();
      onClose();

    } catch (e) {
      const msg = e instanceof Error ? e.message : "שגיאה בקליטה";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const supplierName = useMemo(
    () => suppliers.find((s) => s.id === supplierId)?.name ?? "",
    [suppliers, supplierId],
  );

  // Per-field V / X buttons (shows only when OCR was used).
  const ValBtns = ({ state, onApprove, onReject }: { state: ValState; onApprove: () => void; onReject: () => void }) => (
    <div className="inline-flex items-center gap-1 shrink-0">
      <button type="button" onClick={onApprove} aria-label="ה-AI צדק" title="ה-AI צדק"
        className={`h-9 w-9 grid place-content-center rounded-md border transition ${
          state === "approved"
            ? "bg-emerald-500 border-emerald-400 text-black shadow-[0_0_10px_rgba(16,185,129,0.5)]"
            : "border-border text-muted-foreground hover:border-emerald-400 hover:text-emerald-400"
        }`}>
        <Check className="h-3.5 w-3.5" />
      </button>
      <button type="button" onClick={onReject} aria-label="טעות — תקן ידנית" title="טעות — תקן ידנית"
        className={`h-9 w-9 grid place-content-center rounded-md border transition ${
          state === "corrected"
            ? "bg-rose-500 border-rose-400 text-white shadow-[0_0_10px_rgba(244,63,94,0.5)]"
            : "border-border text-muted-foreground hover:border-rose-400 hover:text-rose-400"
        }`}>
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
  const valBorder = (s: ValState) =>
    s === "approved" ? "border-emerald-500/60"
      : s === "corrected" ? "border-rose-500/70 ring-1 ring-rose-500/30"
      : "border-border";

  return (

    <div className="fixed inset-0 z-50 bg-background/90 backdrop-blur-sm grid place-items-center p-3" onClick={onClose} dir="rtl">
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-3xl bg-card border border-border rounded-2xl overflow-hidden max-h-[94vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div>
            <div className="text-[10px] uppercase tracking-[0.25em] text-neon font-bold">Smart Goods Receiving</div>
            <h3 className="font-display text-xl font-bold">קליטת חשבונית חכמה</h3>
          </div>
          <button onClick={onClose} className="h-8 w-8 grid place-content-center rounded-md border border-border hover:text-neon" aria-label="סגור">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="overflow-y-auto p-4 space-y-4">
          {stage === "pick" && (
            <>
              {linkedOrderId && chosenMatch && (
                <div className="rounded-md border border-neon/60 bg-neon/5 px-3 py-2 text-xs text-neon font-bold">
                  קליטה עבור הזמנת {chosenMatch.supplier_name} מתאריך {new Date(chosenMatch.sent_at).toLocaleDateString("he-IL")}
                </div>
              )}
              <div>
                <label className="block text-xs font-bold text-muted-foreground mb-1">ספק (רמז לזיהוי)</label>
                <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} disabled={!!linkedOrderId}
                  className="w-full h-10 rounded-md bg-background border border-border px-2.5 text-sm focus:border-neon outline-none disabled:opacity-60">
                  <option value="">זיהוי אוטומטי…</option>
                  {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <input ref={fileInput} type="file" accept="image/*" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0] ?? null; e.target.value = ""; onFile(f); }} />
              {previewUrl ? (
                <div className="relative">
                  <img src={previewUrl} alt="חשבונית" className="w-full max-h-80 object-contain rounded-xl bg-zinc-900/60 border border-border" />
                  <button onClick={() => fileInput.current?.click()} className="absolute top-2 left-2 h-8 px-3 rounded-md bg-zinc-900/80 text-xs font-bold hover:text-neon border border-border">
                    החלף תמונה
                  </button>
                </div>
              ) : (
                <button type="button" onClick={() => fileInput.current?.click()}
                  className="w-full text-center text-muted-foreground text-sm border-2 border-dashed border-border rounded-xl p-10 hover:border-neon hover:text-neon transition bg-zinc-900/40">
                  <Upload className="h-8 w-8 mx-auto mb-2" />
                  לחץ לפתיחת מצלמה או גרירת קובץ
                </button>
              )}
              <button type="button" onClick={() => start()} disabled={!file}
                className="w-full h-12 inline-flex items-center justify-center gap-2 rounded-md font-bold text-white disabled:opacity-40"
                style={{ background: "linear-gradient(135deg, #ff2db4, #ff5ec0)", boxShadow: "0 0 22px rgba(255,45,180,0.45)" }}>
                <ScanSearch className="h-4 w-4" /> נתח חשבונית
              </button>
              <button
                type="button"
                onClick={() => {
                  // Manual entry without OCR
                  if (chosenMatch) {
                    setRows(chosenMatch.items.map((oi) => ({
                      name: oi.name,
                      orderedQty: Number(oi.qty.replace(/[^\d.]/g, "")) || null,
                      invoiceQty: Number(oi.qty.replace(/[^\d.]/g, "")) || 0,
                      unitPrice: 0,
                      totalPrice: 0,
                      category: lookupCategory(oi.name),
                      ...blankMatch(),
                    })));
                  } else {
                    setRows([{ name: "", orderedQty: null, invoiceQty: 0, unitPrice: 0, totalPrice: 0, category: "", ...blankMatch() }]);

                  }
                  setStage("manual");
                }}
                className="block mx-auto text-sm text-zinc-400 underline cursor-pointer hover:text-neon transition"
              >
                המצלמה לא עובדת? הזן נתונים ידנית
              </button>
            </>
          )}


          {/* STAGE: suggest match */}
          {stage === "suggest" && (
            <>
              {previewUrl && <img src={previewUrl} alt="חשבונית" className="w-full max-h-44 object-contain rounded-xl bg-zinc-900/60 border border-border" />}
              <div className="rounded-xl border-2 border-neon/60 bg-neon/5 p-4 space-y-3">
                <div className="flex items-center gap-2 text-neon font-bold">
                  <CheckCircle2 className="h-5 w-5" /> מצאתי התאמה!
                </div>
                {matches.slice(0, 1).map((m) => (
                  <div key={m.order_id} className="text-sm">
                    <div><span className="text-muted-foreground">ספק:</span> <b>{m.supplier_name}</b></div>
                    <div><span className="text-muted-foreground">נשלחה:</span> {new Date(m.sent_at).toLocaleString("he-IL")}</div>
                    <div><span className="text-muted-foreground">פריטים:</span> {m.items.map((i) => `${i.name} (${i.qty})`).join(", ")}</div>
                  </div>
                ))}
                <div className="flex flex-col sm:flex-row gap-2 pt-1">
                  <button onClick={() => linkToMatch(matches[0])}
                    className="flex-1 h-11 rounded-md font-bold text-white bg-neon hover:opacity-90 inline-flex items-center justify-center gap-2">
                    <Link2 className="h-4 w-4" /> שייך את הקבלה להזמנה זו
                  </button>
                  <button onClick={() => skipMatch()}
                    className="h-11 px-4 rounded-md border border-border hover:border-neon hover:text-neon font-bold text-sm">
                    זו הזמנה אחרת / בחר ידנית
                  </button>
                </div>
                {matches.length > 1 && (
                  <details className="text-xs text-muted-foreground">
                    <summary className="cursor-pointer">הזמנות נוספות אפשריות ({matches.length - 1})</summary>
                    <div className="mt-2 space-y-1">
                      {matches.slice(1).map((m) => (
                        <button key={m.order_id} onClick={() => linkToMatch(m)}
                          className="block w-full text-right p-2 rounded border border-border hover:border-neon">
                          {m.supplier_name} · {new Date(m.sent_at).toLocaleString("he-IL")}
                        </button>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            </>
          )}

          {/* STAGE: verify (side-by-side) */}
          {(stage === "verify" || stage === "manual") && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr] gap-4">
                {previewUrl && <img src={previewUrl} alt="חשבונית" className="w-full max-h-72 object-contain rounded-xl bg-zinc-900/60 border border-border" />}
                <div className="space-y-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="block text-xs font-bold text-muted-foreground">ספק *</label>
                    <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} disabled={!!linkedOrderId}
                      className="w-full h-11 rounded-md bg-background border border-border px-3 text-sm leading-none focus:border-neon outline-none disabled:opacity-60">
                      <option value="">בחר ספק…</option>
                      {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1.5">
                      <label className="flex items-center justify-between text-xs font-bold text-muted-foreground">
                        <span>מס׳ חשבונית</span>
                        {aiActive && <ValBtns state={headerVal.invoice_number} onApprove={() => setHV("invoice_number", "approved")} onReject={() => setHV("invoice_number", "corrected")} />}
                      </label>
                      <input value={invoiceNumber} onChange={(e) => { setInvoiceNumber(e.target.value); if (aiActive) markHeaderEdited("invoice_number"); }}
                        className={`w-full h-11 rounded-md bg-background border px-3 text-sm leading-none focus:border-neon outline-none ${aiActive ? valBorder(headerVal.invoice_number) : "border-border"}`} />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="flex items-center justify-between text-xs font-bold text-muted-foreground">
                        <span>תאריך *</span>
                        {aiActive && <ValBtns state={headerVal.document_date} onApprove={() => setHV("document_date", "approved")} onReject={() => setHV("document_date", "corrected")} />}
                      </label>
                      <input type="date" value={docDate} onChange={(e) => { setDocDate(e.target.value); if (aiActive) markHeaderEdited("document_date"); }}
                        className={`w-full h-11 rounded-md bg-background border px-3 text-sm leading-none focus:border-neon outline-none [&::-webkit-datetime-edit]:py-0 [&::-webkit-datetime-edit]:leading-none [&::-webkit-calendar-picker-indicator]:cursor-pointer ${aiActive ? valBorder(headerVal.document_date) : "border-border"}`} />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="flex items-center justify-between text-xs font-bold text-muted-foreground">
                      <span>סכום כולל ₪ *</span>
                      {aiActive && <ValBtns state={headerVal.total_amount} onApprove={() => setHV("total_amount", "approved")} onReject={() => setHV("total_amount", "corrected")} />}
                    </label>
                    <input type="number" step="0.01" value={totalAmount} onChange={(e) => { setTotalAmount(e.target.value); if (aiActive) markHeaderEdited("total_amount"); }}
                      className={`w-full h-11 rounded-md bg-background border-2 px-3 text-base font-bold leading-none focus:border-neon outline-none tabular-nums ${aiActive ? valBorder(headerVal.total_amount) : "border-border"}`} />
                  </div>

                  {/* Estimated total from catalog cost_price × qty (with manual override) */}
                  {(() => {
                    const est = rows.reduce((sum, r) => {
                      const unit = r.catalogCostPrice ?? r.unitPrice ?? 0;
                      return sum + (Number(r.invoiceQty) || 0) * (Number(unit) || 0);
                    }, 0);
                    if (est <= 0) return null;
                    return (
                      <div className="rounded-md border border-amber-brand/40 bg-amber-brand/5 p-2 space-y-1.5">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-muted-foreground">סה״כ משוער (מחיר עלות × כמות)</span>
                          <span className="font-bold text-amber-brand tabular-nums">₪{est.toFixed(2)}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number" step="0.01" inputMode="decimal"
                            value={estimatedTotalOverride}
                            onChange={(e) => setEstimatedTotalOverride(e.target.value)}
                            placeholder="עקיפה ידנית (אופציונלי)"
                            className="flex-1 h-8 rounded bg-background border border-border px-2 text-[11px] tabular-nums focus:border-amber-brand outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => { setTotalAmount(String((Number(estimatedTotalOverride) || est).toFixed(2))); markHeaderEdited("total_amount"); }}
                            className="h-8 px-2 rounded border border-amber-brand/60 text-amber-brand text-[11px] font-bold hover:bg-amber-brand/10"
                          >
                            השתמש בסכום
                          </button>
                        </div>
                      </div>
                    );
                  })()}


                  {chosenMatch && (
                    <div className="text-[11px] text-neon">✓ משויך להזמנה {new Date(chosenMatch.sent_at).toLocaleDateString("he-IL")} · {supplierName}</div>
                  )}
                </div>
              </div>


              <div className="mt-6">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-sm font-bold">השוואת פריטים</div>
                  {chosenMatch && (
                    <div className="text-[11px] text-muted-foreground">השווה הוזמן ↔ חשבונית. פערים מסומנים באדום.</div>
                  )}
                </div>
                <div className="rounded-xl border border-border p-2">
                  {(() => {
                    const cols = chosenMatch
                      ? "grid-cols-[1fr_56px_72px_72px_72px]"
                      : "grid-cols-[1fr_72px_72px_72px]";
                    return (
                      <>
                        <div className={`hidden sm:grid ${cols} gap-2 px-1 pb-2 text-[11px] font-bold text-muted-foreground`}>
                          <div className="text-right">פריט</div>
                          {chosenMatch && <div className="text-center">הוזמן</div>}
                          <div className="text-center">בחשבונית</div>
                          <div className="text-center">יח׳ ₪</div>
                          <div className="text-center">סה״כ ₪</div>
                        </div>
                        {rows.length === 0 && (
                          <div className="px-3 py-6 text-center text-xs text-muted-foreground">לא זוהו פריטים</div>
                        )}
                        <div className="flex flex-col gap-3" dir="rtl">
                          {rows.map((r, i) => {
                            const mismatch = chosenMatch && r.orderedQty != null && Math.abs(r.invoiceQty - r.orderedQty) > 0.001;
                            const isExtra = chosenMatch && r.orderedQty == null;
                            const rowState: ValState = itemVal[i] ?? "pending";
                            const rowRing = aiActive
                              ? (rowState === "approved" ? "ring-1 ring-emerald-500/40" : rowState === "corrected" ? "ring-1 ring-rose-500/40" : "")
                              : "";
                            return (
                              <div key={i} className={`rounded-lg p-3 border shadow-sm space-y-3 ${isExtra ? "bg-amber-brand/5 border-amber-brand/30" : "bg-card/60 border-border/60"} ${rowRing} ${!r.received ? "bg-rose-500/5 border-rose-500/40" : ""}`}>
                                {/* Row 1 — Item name + AI feedback */}
                                <div className="flex items-center gap-2">
                                  <input value={r.name} onChange={(e) => { setRows((p) => p.map((x, idx) => idx === i ? { ...x, name: e.target.value } : x)); if (aiActive) markItemEdited(i); }}
                                    placeholder="שם פריט"
                                    className={`flex-1 min-w-0 h-10 rounded bg-background border px-2 text-sm font-bold leading-none ${aiActive ? valBorder(rowState) : "border-border"}`} />
                                  {aiActive && (
                                    <div className="inline-flex items-center gap-1 shrink-0" title="משוב לזיהוי AI בלבד — לא משנה סטטוס אספקה">
                                      <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">AI</span>
                                      <ValBtns state={rowState} onApprove={() => setIV(i, "approved")} onReject={() => setIV(i, "corrected")} />
                                    </div>
                                  )}
                                </div>
                                {isExtra && <div className="text-[10px] text-amber-brand">פריט לא בהזמנה</div>}

                                {/* Row 2 — Received checkbox + quantity / prices */}
                                <div className="flex flex-wrap items-end gap-3">
                                  <label className="inline-flex items-center gap-2 text-xs font-bold cursor-pointer select-none order-1">
                                    <input
                                      type="checkbox"
                                      checked={r.received}
                                      onChange={(e) => {
                                        const v = e.target.checked;
                                        setRows((p) => p.map((x, idx) => idx === i ? { ...x, received: v, notReceivedReason: v ? null : (x.notReceivedReason ?? "missing") } : x));
                                      }}
                                      className="h-5 w-5 accent-emerald-500"
                                    />
                                    <span className={r.received ? "text-emerald-400" : "text-rose-400"}>
                                      {r.received ? "✓ הגיע" : "✗ לא הגיע"}
                                    </span>
                                  </label>

                                  {chosenMatch && (
                                    <div className="text-[11px] text-muted-foreground order-2">
                                      <div className="mb-0.5">הוזמן</div>
                                      <div className="h-10 w-16 grid place-items-center rounded bg-background/40 border border-border tabular-nums">{r.orderedQty ?? "—"}</div>
                                    </div>
                                  )}

                                  <div className="order-3">
                                    <div className="text-[11px] text-muted-foreground mb-0.5">כמות</div>
                                    <input type="number" step="0.01" inputMode="decimal" value={r.invoiceQty}
                                      onChange={(e) => { setRows((p) => p.map((x, idx) => idx === i ? { ...x, invoiceQty: Number(e.target.value) } : x)); if (aiActive) markItemEdited(i); }}
                                      className={`w-20 h-10 rounded bg-background border px-2 text-sm leading-none text-center tabular-nums ${mismatch ? "border-red-500 text-red-500 font-bold" : "border-border"}`} />
                                  </div>

                                  <div className="order-4">
                                    <div className="text-[11px] text-muted-foreground mb-0.5">יח׳ ₪</div>
                                    <input type="number" step="0.01" inputMode="decimal" value={r.unitPrice}
                                      onChange={(e) => { setRows((p) => p.map((x, idx) => idx === i ? { ...x, unitPrice: Number(e.target.value) } : x)); if (aiActive) markItemEdited(i); }}
                                      className="w-20 h-10 rounded bg-background border border-border px-2 text-sm leading-none text-center tabular-nums" />
                                  </div>

                                  <div className="order-5">
                                    <div className="text-[11px] text-muted-foreground mb-0.5">סה״כ ₪</div>
                                    <input type="number" step="0.01" inputMode="decimal" value={r.totalPrice}
                                      onChange={(e) => setRows((p) => p.map((x, idx) => idx === i ? { ...x, totalPrice: Number(e.target.value) } : x))}
                                      className="w-24 h-10 rounded bg-background border border-border px-2 text-sm leading-none text-center tabular-nums" />
                                  </div>
                                </div>

                                {/* Row 3 — Accounting category */}
                                <select
                                  value={r.category}
                                  onChange={(e) => setRows((p) => p.map((x, idx) => idx === i ? { ...x, category: e.target.value as ExpenseCategory | "" } : x))}
                                  className={`w-full h-10 rounded bg-background border px-2 text-xs leading-none focus:border-neon outline-none ${r.category ? "border-neon/50 text-neon" : "border-border text-muted-foreground"}`}
                                  aria-label="שיוך חשבונאי"
                                >
                                  <option value="">שיוך חשבונאי…</option>
                                  {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                                </select>

                                {/* Row 4 — Discrepancy reason (only when not received) */}
                                {!r.received && (
                                  <div className="flex flex-wrap items-center gap-2 rounded-md border border-rose-500/40 bg-rose-500/5 p-2">
                                    <span className="text-[11px] font-bold text-rose-300">סיבת חריגה:</span>
                                    <select
                                      value={r.notReceivedReason ?? "missing"}
                                      onChange={(e) => setRows((p) => p.map((x, idx) => idx === i ? { ...x, notReceivedReason: e.target.value as NotReceivedReason } : x))}
                                      className="flex-1 min-w-[140px] h-9 rounded bg-background border border-rose-500/50 text-rose-300 px-2 text-xs focus:border-rose-400 outline-none"
                                      aria-label="סיבה"
                                    >
                                      <option value="missing">חסר במשלוח</option>
                                      <option value="damaged">פגום / לא תקין</option>
                                    </select>
                                    <span className="basis-full text-[10px] text-rose-300/80">לא יתעדכן במלאי · ייפתח דוח חריגה</span>
                                  </div>
                                )}

                                {/* Row 5 — Catalog match */}
                                <CatalogMatchRow
                                  row={r}
                                  catalog={catalog}
                                  onPick={(productId) => {
                                    const cat = catalog.find((c) => c.id === productId);
                                    const cost = cat?.cost_price ?? cat?.expected_price ?? cat?.price ?? null;
                                    setRows((p) => p.map((x, idx) => idx === i ? { ...x, catalogProductId: productId, catalogCostPrice: cost, matchStatus: "manual" } : x));
                                  }}
                                  onMarkNew={() => setRows((p) => p.map((x, idx) => idx === i ? { ...x, catalogProductId: null, matchStatus: "new" } : x))}
                                />
                              </div>
                            );
                          })}

                        </div>

                      </>
                    );
                  })()}
                </div>
                <button
                  type="button"
                  onClick={() => setRows((p) => [...p, { name: "", orderedQty: null, invoiceQty: 0, unitPrice: 0, totalPrice: 0, category: "", ...blankMatch() }])}
                  className="mt-3 w-full h-10 inline-flex items-center justify-center gap-1.5 rounded-md border-2 border-dashed border-border hover:border-neon hover:text-neon text-xs font-bold"
                >
                  + הוסף שורה
                </button>

                {!file && (
                  <button
                    type="button"
                    onClick={() => fileInput.current?.click()}
                    className="mt-2 w-full h-9 inline-flex items-center justify-center gap-2 rounded-md border border-border hover:border-neon hover:text-neon text-xs font-bold"
                  >
                    <Upload className="h-3.5 w-3.5" /> צרף תמונת חשבונית (אופציונלי)
                  </button>
                )}
                {chosenMatch && rows.some((r) => r.orderedQty != null && Math.abs(r.invoiceQty - (r.orderedQty ?? 0)) > 0.001) && (
                  <div className="mt-2 flex items-center gap-2 text-red-500 text-xs font-bold">
                    <AlertTriangle className="h-3.5 w-3.5" /> זוהו פערים בין הכמות שהוזמנה לכמות שהתקבלה — נדרש אישור ידני.
                  </div>
                )}
              </div>


              {aiActive && (
                <div className="space-y-2">
                  <div className={`text-[11px] text-center font-bold tabular-nums px-3 py-2 rounded-md border ${
                    pendingCount === 0
                      ? (correctedCount === 0
                          ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-400"
                          : "border-amber-brand/50 bg-amber-brand/10 text-amber-brand")
                      : "border-border bg-background/40 text-muted-foreground"
                  }`}>
                    {pendingCount === 0
                      ? (correctedCount === 0
                          ? `✓ ${approvedCount} שדות אושרו`
                          : `${approvedCount} ✓ · ${correctedCount} ✗ — ה-AI ילמד מהתיקונים`)
                      : `סמן ✓ אם ה-AI צדק או ✗ אם תיקנת — נותרו ${pendingCount} שדות (אופציונלי)`}
                  </div>
                  {pendingCount > 0 && (
                    <button type="button"
                      onClick={() => {
                        setHeaderVal((p) => {
                          const next = { ...p };
                          (Object.keys(next) as HeaderKey[]).forEach((k) => { if (next[k] === "pending") next[k] = "approved"; });
                          return next;
                        });
                        setItemVal((p) => p.map((s) => (s === "pending" ? "approved" : s)));
                      }}
                      className="w-full h-9 inline-flex items-center justify-center gap-2 rounded-md font-semibold text-xs border border-emerald-500/40 bg-emerald-500/5 text-emerald-400 hover:bg-emerald-500/15 transition"
                    >
                      ✓ אשר את כל מה שנשאר ({pendingCount})
                    </button>
                  )}
                </div>
              )}

              <button type="button" onClick={submit} disabled={!canSubmit}
                className="w-full h-12 inline-flex items-center justify-center gap-2 rounded-md font-bold text-white transition disabled:opacity-40"
                style={{ background: "linear-gradient(135deg, #ff2db4, #ff5ec0)", boxShadow: "0 0 20px rgba(255,45,180,0.45)" }}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                {chosenMatch ? "אשר קליטה וסמן כהתקבל" : "אשר קליטה"}
              </button>

            </>
          )}
        </div>

        {/* Processing overlay */}
        {stage === "processing" && (
          <div className="fixed inset-0 z-[60] bg-zinc-950/90 backdrop-blur-sm grid place-items-center" dir="rtl">
            <div className="text-center space-y-4 max-w-xs px-4">
              <div className="relative h-32 w-32 mx-auto">
                <div className="absolute inset-0 rounded-2xl border-2 border-neon/40 overflow-hidden">
                  <div className="absolute inset-x-0 h-1 bg-neon shadow-[0_0_18px_var(--neon)] scan-bar-y" />
                </div>
                <div className="absolute inset-0 grid place-items-center">
                  <ScanSearch className="h-10 w-10 text-neon animate-pulse" />
                </div>
              </div>
              <div className="font-display text-xl font-bold text-neon text-glow-neon">ג'וני מעבד את הקבלה…</div>
              <div className="text-xs text-muted-foreground">מזהה ספק, פריטים וסכומים, ומחפש הזמנה תואמת</div>
            </div>
            <style>{`
              @keyframes scanYy { 0%{top:0} 50%{top:calc(100% - 4px)} 100%{top:0} }
              .scan-bar-y { animation: scanYy 1.8s ease-in-out infinite; top: 0; }
            `}</style>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Per-row catalog matching strip.
// - "auto"   → green badge with matched product name
// - "manual" → blue badge with chosen product
// - "new"    → amber badge "will be created on save"
// - "review"/"none" → "needs review" + product dropdown + create-new button
// ============================================================
function CatalogMatchRow({
  row,
  catalog,
  onPick,
  onMarkNew,
}: {
  row: RowPair;
  catalog: CatalogOpt[];
  onPick: (productId: string) => void;
  onMarkNew: () => void;
}) {
  if (!row.name.trim()) return null;
  const matchedName = row.catalogProductId
    ? catalog.find((c) => c.id === row.catalogProductId)?.name
    : null;

  if (row.matchStatus === "auto") {
    return (
      <div className="mt-1.5 flex items-center justify-between gap-2 text-[10.5px] px-1">
        <span className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-bold">
          ✓ זוהה בקטלוג: {matchedName}{row.matchSimilarity != null && ` (${Math.round(row.matchSimilarity * 100)}%)`}
        </span>
        <button type="button" onClick={onMarkNew} className="text-[10.5px] text-muted-foreground hover:text-amber-brand underline">
          לא נכון? צור מוצר חדש
        </button>
      </div>
    );
  }
  if (row.matchStatus === "manual") {
    return (
      <div className="mt-1.5 text-[10.5px] px-1 flex items-center gap-1.5">
        <span className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 bg-sky-500/15 text-sky-400 border border-sky-500/30 font-bold">
          🔗 שויך ידנית: {matchedName}
        </span>
      </div>
    );
  }
  if (row.matchStatus === "new") {
    return (
      <div className="mt-1.5 text-[10.5px] px-1 flex items-center gap-1.5">
        <span className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 bg-amber-brand/15 text-amber-brand border border-amber-brand/30 font-bold">
          ＋ ייווצר כמוצר חדש בקטלוג בעת השמירה
        </span>
      </div>
    );
  }
  // review or none → needs review
  return (
    <div className="mt-1.5 px-1 flex flex-col sm:flex-row gap-1.5 sm:items-center">
      <span className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 bg-rose-500/15 text-rose-400 border border-rose-500/30 font-bold text-[10.5px] shrink-0">
        ⚠ דורש התאמה
      </span>
      <select
        value={row.catalogProductId ?? ""}
        onChange={(e) => { if (e.target.value) onPick(e.target.value); }}
        className="flex-1 min-w-0 h-8 rounded bg-background border border-border px-2 text-[11px] focus:border-neon outline-none"
        aria-label="בחר מוצר מהקטלוג"
      >
        <option value="">בחר מקטלוג הספק…</option>
        {catalog.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      <button
        type="button"
        onClick={onMarkNew}
        className="shrink-0 inline-flex items-center gap-1 h-8 px-2 rounded border border-amber-brand/50 text-amber-brand text-[10.5px] font-bold hover:bg-amber-brand/10"
      >
        ＋ צור חדש
      </button>
    </div>
  );
}

