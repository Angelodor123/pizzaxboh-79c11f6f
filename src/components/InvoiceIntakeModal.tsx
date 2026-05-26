import { useEffect, useMemo, useRef, useState } from "react";
import { X, Upload, Plus, Trash2, Loader2, AlertTriangle, ZoomIn, ZoomOut, RotateCcw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { requireCurrentBranchId } from "@/lib/current-branch";
import { parseInvoiceImage } from "@/lib/invoice-ocr.functions";

interface SupplierOpt { id: string; name: string }

interface ItemRow { item_name: string; quantity: string; unit_price: string; total_price: string }

interface InventoryOpt { id: string; name: string; unit: string }


interface Props {
  suppliers: SupplierOpt[];
  onClose: () => void;
  onSaved: () => void;
}

const DRAFT_KEY = "invoice-intake-draft";
const HARD_LIMIT = 15000;

export function InvoiceIntakeModal({ suppliers, onClose, onSaved }: Props) {
  const [supplierId, setSupplierId] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [docDate, setDocDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [items, setItems] = useState<ItemRow[]>([{ item_name: "", quantity: "", unit_price: "", total_price: "" }]);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showAnomaly, setShowAnomaly] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [inventory, setInventory] = useState<InventoryOpt[]>([]);
  const [ocrLoading, setOcrLoading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const runOcr = useServerFn(parseInvoiceImage);

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



  // Restore draft
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const d = JSON.parse(raw);
        setSupplierId(d.supplierId ?? "");
        setInvoiceNumber(d.invoiceNumber ?? "");
        setTotalAmount(d.totalAmount ?? "");
        setDocDate(d.docDate ?? new Date().toISOString().slice(0, 10));
        if (Array.isArray(d.items) && d.items.length) setItems(d.items);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    const id = setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({ supplierId, invoiceNumber, totalAmount, docDate, items }));
      } catch { /* ignore */ }
    }, 200);
    return () => clearTimeout(id);
  }, [supplierId, invoiceNumber, totalAmount, docDate, items]);

  // Cleanup blob URL on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

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

  const onFileSelected = (f: File | null) => {
    setFile(f);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(f ? URL.createObjectURL(f) : null);
    if (f) {
      setUploading(true);
      setTimeout(() => setUploading(false), 1400);
    }
  };

  const addItem = () => setItems((p) => [...p, { item_name: "", quantity: "", unit_price: "", total_price: "" }]);
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
      const branchId = await requireCurrentBranchId();
      let imageUrl: string | null = null;

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

      const cleanItems = items.filter((r) => r.item_name.trim());
      if (cleanItems.length && invoiceRow) {
        const rows = cleanItems.map((r, idx) => ({
          invoice_id: invoiceRow.id,
          item_name: r.item_name.trim().slice(0, 200),
          quantity: Number(r.quantity) || 0,
          unit_price: Number(r.unit_price) || 0,
          total_price: Number(r.total_price) || (Number(r.quantity) * Number(r.unit_price)) || 0,
          sort_order: idx,
        }));
        await supabase.from("invoice_items").insert(rows);
      }

      try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
      toast.success("החשבונית נקלטה בהצלחה");
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
    if (await checkAnomaly()) {
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
            <div className="text-[10px] uppercase tracking-[0.25em] text-neon font-bold">Goods Receiving</div>
            <h3 className="font-display text-xl font-bold">קליטת חשבונית חדשה</h3>
          </div>
          <button onClick={onClose} className="h-8 w-8 grid place-content-center rounded-md border border-border hover:text-neon" aria-label="סגור">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid lg:grid-cols-2 gap-0 flex-1 overflow-hidden">
          {/* Left: image */}
          <div className="bg-zinc-900/60 border-b lg:border-b-0 lg:border-l border-border flex flex-col">
            <div className="p-3 flex items-center justify-between gap-2 border-b border-border/50">
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
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-border hover:border-neon hover:text-neon text-sm font-bold"
              >
                <Upload className="h-4 w-4" />
                {file ? "החלף תמונה" : "העלה תמונה"}
              </button>
              {previewUrl && (
                <div className="flex items-center gap-1">
                  <button onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))} className="h-9 w-9 grid place-content-center rounded-md border border-border hover:text-neon" aria-label="הקטן">
                    <ZoomOut className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => setZoom(1)} className="h-9 w-9 grid place-content-center rounded-md border border-border hover:text-neon" aria-label="אפס">
                    <RotateCcw className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => setZoom((z) => Math.min(3, z + 0.25))} className="h-9 w-9 grid place-content-center rounded-md border border-border hover:text-neon" aria-label="הגדל">
                    <ZoomIn className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
            <div className="relative flex-1 overflow-auto min-h-[260px] grid place-items-center p-4">
              {previewUrl ? (
                <>
                  <img
                    src={previewUrl}
                    alt="חשבונית"
                    style={{ transform: `scale(${zoom})`, transformOrigin: "center" }}
                    className="max-w-full max-h-full object-contain transition-transform"
                  />
                  {uploading && (
                    <div className="absolute inset-0 pointer-events-none overflow-hidden">
                      <div className="absolute inset-x-0 h-1 bg-neon/70 shadow-[0_0_18px_var(--neon)] scan-bar" />
                      <div className="absolute bottom-3 left-3 text-[10px] font-bold text-neon uppercase tracking-widest">Scanning Document…</div>
                    </div>
                  )}
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInput.current?.click()}
                  className="text-center text-muted-foreground text-sm border-2 border-dashed border-border rounded-xl p-8 hover:border-neon hover:text-neon transition"
                >
                  <Upload className="h-8 w-8 mx-auto mb-2" />
                  לחץ להעלאת תמונת חשבונית
                </button>
              )}
            </div>
            <style>{`
              @keyframes scanY { 0%{top:0} 100%{top:100%} }
              .scan-bar { animation: scanY 1.6s linear infinite; top: 0; }
            `}</style>
          </div>

          {/* Right: form */}
          <div className="overflow-y-auto p-4 space-y-3">
            <div>
              <label className="block text-xs font-bold text-muted-foreground mb-1">ספק</label>
              <select
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                className="w-full h-10 rounded-md bg-background border border-border px-2.5 text-sm focus:border-neon outline-none"
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
                  className="w-full h-10 rounded-md bg-background border border-border px-2.5 text-sm focus:border-neon outline-none"
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
                  className="w-full h-10 rounded-md bg-background border border-border px-2.5 text-sm focus:border-neon outline-none"
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
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-muted-foreground">פריטים</span>
                <button type="button" onClick={addItem} className="text-xs font-bold text-neon inline-flex items-center gap-1">
                  <Plus className="h-3 w-3" /> הוסף פריט
                </button>
              </div>
              <div className="space-y-1.5">
                {items.map((row, i) => (
                  <div key={i} className="grid grid-cols-[1fr_64px_72px_72px_32px] gap-1">
                    <input placeholder="פריט" value={row.item_name} onChange={(e) => updateItem(i, "item_name", e.target.value)} className="h-9 rounded-md bg-background border border-border px-2 text-xs" dir="rtl" />
                    <input placeholder="כמות" value={row.quantity} onChange={(e) => updateItem(i, "quantity", e.target.value)} className="h-9 rounded-md bg-background border border-border px-2 text-xs tabular-nums" inputMode="decimal" />
                    <input placeholder="יחידה" value={row.unit_price} onChange={(e) => updateItem(i, "unit_price", e.target.value)} className="h-9 rounded-md bg-background border border-border px-2 text-xs tabular-nums" inputMode="decimal" />
                    <input placeholder="סה״כ" value={row.total_price} onChange={(e) => updateItem(i, "total_price", e.target.value)} className="h-9 rounded-md bg-background border border-border px-2 text-xs tabular-nums" inputMode="decimal" />
                    <button type="button" onClick={() => removeItem(i)} className="h-9 w-8 grid place-content-center rounded-md border border-border hover:border-destructive hover:text-destructive">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-3 border-t border-border">
              <button
                type="button"
                onClick={handleConfirm}
                disabled={!formValid || submitting}
                className="w-full h-11 inline-flex items-center justify-center gap-2 rounded-md font-bold text-white transition disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: "linear-gradient(135deg, #ff2db4, #ff5ec0)", boxShadow: "0 0 20px rgba(255,45,180,0.45)" }}
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                אשר קליטה
              </button>
              {!formValid && (
                <p className="text-[11px] text-muted-foreground mt-1.5 text-center">
                  יש למלא ספק, סכום כולל ותאריך כדי להמשיך.
                </p>
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
