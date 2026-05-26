import { useEffect, useMemo, useRef, useState } from "react";
import { X, Upload, Loader2, CheckCircle2, AlertTriangle, ScanSearch, Link2 } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { requireCurrentBranchId } from "@/lib/current-branch";
import { ocrInvoice } from "@/lib/receiving.functions";

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
type RowPair = {
  name: string;
  orderedQty: number | null;
  invoiceQty: number;
  unitPrice: number;
  totalPrice: number;
};

type Stage = "pick" | "processing" | "suggest" | "verify" | "manual";

const fileToBase64 = (file: File): Promise<string> => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => {
    const s = String(r.result || "");
    const idx = s.indexOf(",");
    resolve(idx >= 0 ? s.slice(idx + 1) : s);
  };
  r.onerror = reject;
  r.readAsDataURL(file);
});

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
const looseEq = (a: string, b: string) => {
  const x = norm(a), y = norm(b);
  if (!x || !y) return false;
  return x === y || x.includes(y) || y.includes(x);
};

export function SmartReceivingModal({ suppliers, onClose, onSaved, linkedOrderId = null }: Props) {
  const ocr = useServerFn(ocrInvoice);
  const [stage, setStage] = useState<Stage>("pick");
  const [supplierId, setSupplierId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [chosenMatch, setChosenMatch] = useState<Match | null>(null);
  const [rows, setRows] = useState<RowPair[]>([]);
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [docDate, setDocDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [submitting, setSubmitting] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

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

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const onFile = (f: File | null) => {
    setFile(f);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(f ? URL.createObjectURL(f) : null);
  };

  const start = async () => {
    if (!file) return toast.error("יש להעלות תמונת חשבונית");
    setStage("processing");
    try {
      const b64 = await fileToBase64(file);
      const res = await ocr({
        data: {
          imageBase64: b64,
          mimeType: file.type || "image/jpeg",
          supplierHintId: supplierId || null,
        },
      });
      if (res.error) toast.warning(res.error);
      setParsed(res.parsed ?? null);
      setMatches(res.matches ?? []);
      if (res.parsed?.invoice_number) setInvoiceNumber(res.parsed.invoice_number);
      if (res.parsed?.total_amount != null) setTotalAmount(String(res.parsed.total_amount));
      if (res.parsed?.document_date) setDocDate(res.parsed.document_date);
      // If contextually linked to a specific order, auto-link and jump to verify
      if (linkedOrderId && chosenMatch) {
        linkToMatch(chosenMatch);
        return;
      }
      if ((res.matches?.length ?? 0) > 0) setStage("suggest");
      else setStage("manual");
    } catch (e) {
      console.error(e);
      toast.error("ניתוח החשבונית נכשל");
      setStage("pick");
    }
  };

  const linkToMatch = (m: Match) => {
    setChosenMatch(m);
    setSupplierId(m.supplier_id);
    const ocrItems = parsed?.items ?? [];
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
      return { name: oi.name, orderedQty, invoiceQty: invQty, unitPrice: up, totalPrice: tp };
    });
    // Extra invoice items not on the order
    ocrItems.forEach((it, i) => {
      if (used.has(i)) return;
      pairs.push({
        name: it.name, orderedQty: null,
        invoiceQty: Number(it.quantity) || 0,
        unitPrice: Number(it.unit_price) || 0,
        totalPrice: Number(it.total_price) || 0,
      });
    });
    setRows(pairs);
    setStage("verify");
  };

  const skipMatch = () => {
    // populate rows from OCR only
    const ocrItems = parsed?.items ?? [];
    setRows(ocrItems.map((it) => ({
      name: it.name, orderedQty: null,
      invoiceQty: Number(it.quantity) || 0,
      unitPrice: Number(it.unit_price) || 0,
      totalPrice: Number(it.total_price) || 0,
    })));
    setStage("manual");
  };

  const totalNum = Number(totalAmount);
  const canSubmit = supplierId && !Number.isNaN(totalNum) && totalNum > 0 && docDate && !submitting;

  const submit = async () => {
    if (!canSubmit) return;
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


      // Invoice items
      const cleanItems = rows.filter((r) => r.name.trim());
      if (cleanItems.length && invoiceRow) {
        await supabase.from("invoice_items").insert(cleanItems.map((r, idx) => ({
          invoice_id: invoiceRow.id,
          item_name: r.name.slice(0, 200),
          quantity: r.invoiceQty,
          unit_price: r.unitPrice,
          total_price: r.totalPrice || r.invoiceQty * r.unitPrice,
          sort_order: idx,
        })));
      }

      // Mark order received + update inventory
      if (chosenMatch) {
        await supabase
          .from("orders")
          .update({ status: "received", received_at: new Date().toISOString(), invoice_id: invoiceRow!.id })
          .eq("id", chosenMatch.order_id);
      }

      // Inventory: upsert items + insert movements per received row
      for (const r of cleanItems) {
        if (r.invoiceQty <= 0) continue;
        const name = r.name.trim().slice(0, 200);
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
              <input ref={fileInput} type="file" accept="image/*" capture="environment" className="hidden"
                onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
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
              <button type="button" onClick={start} disabled={!file}
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
                    })));
                  } else {
                    setRows([{ name: "", orderedQty: null, invoiceQty: 0, unitPrice: 0, totalPrice: 0 }]);
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
                  <button onClick={skipMatch}
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
                      <label className="block text-xs font-bold text-muted-foreground">מס׳ חשבונית</label>
                      <input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)}
                        className="w-full h-11 rounded-md bg-background border border-border px-3 text-sm leading-none focus:border-neon outline-none" />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="block text-xs font-bold text-muted-foreground">תאריך *</label>
                      <input type="date" value={docDate} onChange={(e) => setDocDate(e.target.value)}
                        className="w-full h-11 rounded-md bg-background border border-border px-3 text-sm leading-none focus:border-neon outline-none [&::-webkit-datetime-edit]:py-0 [&::-webkit-datetime-edit]:leading-none [&::-webkit-calendar-picker-indicator]:cursor-pointer" />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="block text-xs font-bold text-muted-foreground">סכום כולל ₪ *</label>
                    <input type="number" step="0.01" value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)}
                      className="w-full h-11 rounded-md bg-background border-2 border-border px-3 text-base font-bold leading-none focus:border-neon outline-none tabular-nums" />
                  </div>
                  {chosenMatch && (
                    <div className="text-[11px] text-neon">✓ משויך להזמנה {new Date(chosenMatch.sent_at).toLocaleDateString("he-IL")} · {supplierName}</div>
                  )}
                </div>
              </div>


              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-bold">השוואת פריטים</div>
                  {chosenMatch && (
                    <div className="text-[11px] text-muted-foreground">השווה הוזמן ↔ חשבונית. פערים מסומנים באדום.</div>
                  )}
                </div>
                <div className="rounded-xl border border-border overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-background/60 text-muted-foreground">
                      <tr>
                        <th className="px-2 py-2 text-right">פריט</th>
                        {chosenMatch && <th className="px-2 py-2 text-right w-20">הוזמן</th>}
                        <th className="px-2 py-2 text-right w-24">בחשבונית</th>
                        <th className="px-2 py-2 text-right w-20">יח׳ ₪</th>
                        <th className="px-2 py-2 text-right w-20">סה״כ ₪</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {rows.length === 0 && (
                        <tr><td colSpan={chosenMatch ? 5 : 4} className="px-3 py-6 text-center text-muted-foreground">לא זוהו פריטים</td></tr>
                      )}
                      {rows.map((r, i) => {
                        const mismatch = chosenMatch && r.orderedQty != null && Math.abs(r.invoiceQty - r.orderedQty) > 0.001;
                        const isExtra = chosenMatch && r.orderedQty == null;
                        return (
                          <tr key={i} className={isExtra ? "bg-amber-brand/5" : ""}>
                            <td className="px-2 py-1.5">
                              <input value={r.name} onChange={(e) => setRows((p) => p.map((x, idx) => idx === i ? { ...x, name: e.target.value } : x))}
                                className="w-full h-8 rounded bg-background border border-border px-1.5 text-xs" />
                              {isExtra && <div className="text-[10px] text-amber-brand mt-0.5">פריט לא בהזמנה</div>}
                            </td>
                            {chosenMatch && (
                              <td className="px-2 py-1.5 tabular-nums text-muted-foreground">
                                {r.orderedQty ?? "—"}
                              </td>
                            )}
                            <td className="px-2 py-1.5">
                              <input type="number" step="0.01" value={r.invoiceQty}
                                onChange={(e) => setRows((p) => p.map((x, idx) => idx === i ? { ...x, invoiceQty: Number(e.target.value) } : x))}
                                className={`w-full h-8 rounded bg-background border px-1.5 text-xs tabular-nums ${mismatch ? "border-red-500 text-red-500 font-bold" : "border-border"}`} />
                            </td>
                            <td className="px-2 py-1.5">
                              <input type="number" step="0.01" value={r.unitPrice}
                                onChange={(e) => setRows((p) => p.map((x, idx) => idx === i ? { ...x, unitPrice: Number(e.target.value) } : x))}
                                className="w-full h-8 rounded bg-background border border-border px-1.5 text-xs tabular-nums" />
                            </td>
                            <td className="px-2 py-1.5">
                              <input type="number" step="0.01" value={r.totalPrice}
                                onChange={(e) => setRows((p) => p.map((x, idx) => idx === i ? { ...x, totalPrice: Number(e.target.value) } : x))}
                                className="w-full h-8 rounded bg-background border border-border px-1.5 text-xs tabular-nums" />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <button
                  type="button"
                  onClick={() => setRows((p) => [...p, { name: "", orderedQty: null, invoiceQty: 0, unitPrice: 0, totalPrice: 0 }])}
                  className="mt-2 w-full h-9 inline-flex items-center justify-center gap-1.5 rounded-md border-2 border-dashed border-border hover:border-neon hover:text-neon text-xs font-bold"
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
