import { useEffect, useMemo, useRef, useState } from "react";
import { X, Upload, Plus, Trash2, Loader2, AlertTriangle, ZoomIn, ZoomOut, RotateCcw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { requireCurrentBranchId } from "@/lib/current-branch";
import { parseInvoiceImage, learnFromCorrection, type ParsedInvoice } from "@/lib/invoice-ocr.functions";
import { loadSupplierProducts, type SupplierProduct } from "@/lib/supplier-products";
import { ModalDeleteButton } from "@/components/ModalDeleteButton";

interface SupplierOpt { id: string; name: string }

interface ItemRow { item_name: string; quantity: string; unit_price: string; total_price: string; discount: string }

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
const HARD_LIMIT = 15000;

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
  const [items, setItems] = useState<ItemRow[]>([{ item_name: "", quantity: "", unit_price: "", total_price: "", discount: "" }]);
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
      const rows = (data ?? []).map((r) => ({
        item_name: r.item_name ?? "",
        quantity: r.quantity != null ? String(r.quantity) : "",
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
  const DRAFT_KEY = trainingMode ? DRAFT_KEY_TRAINING : DRAFT_KEY_OPERATIONAL;
  useEffect(() => {
    if (isEdit) return;
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
        // Restore image preview (base64 data URL) so it survives app backgrounding
        // and tab unload on mobile.
        if (typeof d.previewUrl === "string" && d.previewUrl.startsWith("data:")) {
          setPreviewUrl(d.previewUrl);
        }
      }
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit]);

  useEffect(() => {
    if (isEdit) return;
    const id = setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({ supplierId, invoiceNumber, totalAmount, docDate, items, previewUrl }));
      } catch { /* ignore */ }
    }, 200);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supplierId, invoiceNumber, totalAmount, docDate, items, previewUrl, isEdit]);

  // Note: preview is stored as a base64 data URL (not blob:) so it survives
  // tab backgrounding, app minimize, and OS memory pressure. No revoke needed.

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showAnomaly) setShowAnomaly(false);
        else onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, showAnomaly]);

  const totalNum = useMemo(() => Number(totalAmount), [totalAmount]);
  const formValid = supplierId && totalAmount.trim() && !Number.isNaN(totalNum) && totalNum > 0 && docDate;

  const fileToDataUrl = (f: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(f);
    });

  const onFileSelected = async (f: File | null) => {
    setFile(f);
    if (!f) { setPreviewUrl(null); return; }

    setUploading(true);
    setOcrLoading(true);
    try {
      // Read as base64 data URL — persists across app backgrounding,
      // unlike URL.createObjectURL() which may be revoked by the browser.
      const dataUrl = await fileToDataUrl(f);
      setPreviewUrl(dataUrl);

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
      if (parsed.invoice_number) setInvoiceNumber(parsed.invoice_number);
      if (parsed.document_date && /^\d{4}-\d{2}-\d{2}$/.test(parsed.document_date)) {
        setDocDate(parsed.document_date);
      }
      if (typeof parsed.total_amount === "number" && parsed.total_amount > 0) {
        setTotalAmount(String(parsed.total_amount));
      }
      // Suggest supplier by fuzzy name match
      if (parsed.supplier_guess) {
        const guess = parsed.supplier_guess.trim().toLowerCase();
        const match = suppliers.find((s) => s.name.toLowerCase().includes(guess) || guess.includes(s.name.toLowerCase()));
        if (match) setSupplierId(match.id);
      }
      // Populate item rows
      if (Array.isArray(parsed.items) && parsed.items.length > 0) {
        setItems(
          parsed.items.map((it) => ({
            item_name: it.item_name ?? "",
            quantity: it.quantity != null ? String(it.quantity) : "",
            unit_price: it.unit_price != null ? String(it.unit_price) : "",
            total_price: it.total_price != null ? String(it.total_price) : "",
            discount: it.discount ?? "",
          })),
        );
        toast.success(`פוענחו ${parsed.items.length} שורות מהקבלה`);
      } else {
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


  const addItem = () => setItems((p) => [...p, { item_name: "", quantity: "", unit_price: "", total_price: "", discount: "" }]);
  const updateItem = (i: number, k: keyof ItemRow, v: string) =>
    setItems((p) => p.map((row, idx) => (idx === i ? { ...row, [k]: v } : row)));
  const removeItem = (i: number) => setItems((p) => p.filter((_, idx) => idx !== i));

  const checkAnomaly = async (): Promise<boolean> => {
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
        await runLearn({ data: { supplierId, raw: rawOcr, final: finalData } })
          .catch(() => { /* silent */ });
        toast.success("האימון נשמר — ה-AI ילמד מהתיקונים שלך");
        try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
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

      if (file) {
        const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase();
        const path = `${branchId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error: upErr } = await supabase.storage.from("invoice-images").upload(path, file, {
          contentType: file.type || "image/jpeg",
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
            total_amount: totalNum,
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
            total_amount: totalNum,
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


  return (
    <div className="fixed inset-0 z-50 bg-background/90 backdrop-blur-sm grid place-items-center p-3" onClick={onClose} dir="rtl">
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-5xl bg-card border border-border rounded-2xl overflow-hidden max-h-[94vh] flex flex-col"
      >
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div>
            <div className="text-[10px] uppercase tracking-[0.25em] text-neon font-bold">{trainingMode ? "AI Training · Sandbox" : "Goods Receiving"}</div>
            <h3 className="font-display text-xl font-bold">{trainingMode ? "אימון AI מקבלה (לא נשמר במלאי)" : isEdit ? "עריכת חשבונית" : "קליטת חשבונית חדשה"}</h3>
          </div>
          <button onClick={onClose} className="h-8 w-8 grid place-content-center rounded-md border border-border hover:text-neon" aria-label="סגור">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid md:grid-cols-2 gap-0 flex-1 md:overflow-hidden overflow-y-auto">
          {/* Image side: sticky on both mobile (top of scroll) and desktop (side panel) */}
          <div className="bg-zinc-900/60 border-b md:border-b-0 md:border-l border-border flex flex-col sticky top-0 z-20 md:self-start md:h-full md:max-h-[94vh] max-h-[42vh] shadow-md md:shadow-none">
            <div className="p-2 md:p-3 flex items-center justify-between gap-2 border-b border-border/50 shrink-0">
              <input
                ref={fileInput}
                type="file"
                accept="image/*"
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
          <div className="md:overflow-y-auto p-4 md:p-5 flex flex-col gap-4">
            <div>
              <label className="block text-xs font-bold text-muted-foreground mb-1">ספק</label>
              <select
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                className="w-full h-11 rounded-md bg-background border border-border px-2.5 text-sm focus:border-neon outline-none"
              >
                <option value="">בחר ספק…</option>
                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-bold text-muted-foreground mb-1">מס׳ חשבונית</label>
                <input
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  className="w-full h-11 rounded-md bg-background border border-border px-2.5 text-sm focus:border-neon outline-none"
                  maxLength={60}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-muted-foreground mb-1">
                  תאריך חשבונית <span className="text-destructive">*</span>
                </label>
                <input
                  type="date"
                  value={docDate}
                  onChange={(e) => setDocDate(e.target.value)}
                  required
                  className="w-full h-11 rounded-md bg-background border border-border px-2.5 text-sm focus:border-neon outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-muted-foreground mb-1">
                סכום כולל ₪ <span className="text-destructive">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                inputMode="decimal"
                value={totalAmount}
                onChange={(e) => setTotalAmount(e.target.value)}
                required
                className="w-full h-11 rounded-md bg-background border-2 border-border px-2.5 text-base font-bold focus:border-neon outline-none tabular-nums"
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
                  const upN = Number(row.unit_price) || 0;
                  const computed = qtyN * upN;
                  return (
                    <div key={i} className="rounded-lg border border-border bg-background/40 p-2.5 space-y-2">
                      {/* Row 1: index badge + item name (full width) + delete */}
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
                        <button
                          type="button"
                          onClick={() => removeItem(i)}
                          className="shrink-0 h-10 w-10 grid place-content-center rounded-md border border-border text-muted-foreground hover:border-destructive hover:text-destructive transition"
                          aria-label="מחק שורה"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      {/* Row 2: numeric fields with labels above */}
                      <div className="grid grid-cols-4 gap-2">
                        <div>
                          <label className="block text-[10px] font-bold text-muted-foreground mb-0.5 text-center">כמות</label>
                          <input
                            value={row.quantity}
                            onChange={(e) => updateItem(i, "quantity", e.target.value)}
                            className="w-full h-10 rounded-md bg-background border border-border px-2 text-sm text-center tabular-nums font-bold focus:border-neon outline-none"
                            inputMode="decimal"
                            placeholder="0"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-muted-foreground mb-0.5 text-center">מחיר יח׳ ₪</label>
                          <input
                            value={row.unit_price}
                            onChange={(e) => updateItem(i, "unit_price", e.target.value)}
                            className="w-full h-10 rounded-md bg-background border border-border px-2 text-sm text-center tabular-nums font-bold focus:border-neon outline-none"
                            inputMode="decimal"
                            placeholder="0.00"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-muted-foreground mb-0.5 text-center">הנחה</label>
                          <input
                            value={row.discount}
                            onChange={(e) => updateItem(i, "discount", e.target.value)}
                            className={`w-full h-10 rounded-md bg-background border px-2 text-xs text-center font-bold focus:border-neon outline-none ${row.discount ? "border-amber-brand/70 text-amber-brand" : "border-border text-muted-foreground"}`}
                            placeholder="—"
                            title={row.discount ? "המחיר הוזן לאחר ההנחה" : "אין הנחה"}
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-muted-foreground mb-0.5 text-center">סה״כ ₪</label>
                          <input
                            value={row.total_price}
                            onChange={(e) => updateItem(i, "total_price", e.target.value)}
                            className="w-full h-10 rounded-md bg-background border-2 border-border px-2 text-sm text-center tabular-nums font-bold text-neon focus:border-neon outline-none"
                            inputMode="decimal"
                            placeholder={computed > 0 ? computed.toFixed(2) : "0.00"}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>


            <div className="pt-3 border-t border-border space-y-2">
              <button
                type="button"
                onClick={handleConfirm}
                disabled={!formValid || submitting}
                className="w-full h-11 inline-flex items-center justify-center gap-2 rounded-md font-bold text-white transition disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: "linear-gradient(135deg, #ff2db4, #ff5ec0)", boxShadow: "0 0 20px rgba(255,45,180,0.45)" }}
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {trainingMode ? "שמור אימון (ללא השפעה על מלאי)" : isEdit ? "שמור שינויים" : "אשר קליטה"}
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
                הסכום ₪{totalNum.toLocaleString("he-IL")} חורג מהממוצע ההיסטורי של הספק או עובר את התקרה. האם ברצונך להמשיך?
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
