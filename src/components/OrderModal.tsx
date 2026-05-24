import { useEffect, useState } from "react";
import { X, Plus, Trash2, Copy, Send, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { requireCurrentBranchId } from "@/lib/current-branch";
import { compileOrderMessage, whatsappUrl, type OrderRow } from "@/lib/order-template";

interface Supplier {
  id: string;
  name: string;
  category: string;
  contact: string | null;
}

interface Props {
  supplier: Supplier;
  onClose: () => void;
}

const cacheKey = (id: string) => `order-draft:${id}`;

export function OrderModal({ supplier, onClose }: Props) {
  const [rows, setRows] = useState<OrderRow[]>([{ name: "", qty: "" }]);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Restore draft
  useEffect(() => {
    try {
      const raw = localStorage.getItem(cacheKey(supplier.id));
      if (raw) {
        const d = JSON.parse(raw);
        if (Array.isArray(d.rows) && d.rows.length) setRows(d.rows);
        if (typeof d.notes === "string") setNotes(d.notes);
      }
    } catch { /* ignore */ }
  }, [supplier.id]);

  // Persist draft
  useEffect(() => {
    const id = setTimeout(() => {
      try {
        localStorage.setItem(cacheKey(supplier.id), JSON.stringify({ rows, notes }));
      } catch { /* ignore */ }
    }, 200);
    return () => clearTimeout(id);
  }, [rows, notes, supplier.id]);

  const message = compileOrderMessage(rows, notes);
  const hasContent = rows.some((r) => r.name.trim() && r.qty.trim());

  const updateRow = (i: number, key: keyof OrderRow, v: string) =>
    setRows((p) => p.map((r, idx) => (idx === i ? { ...r, [key]: v } : r)));
  const addRow = () => setRows((p) => [...p, { name: "", qty: "" }]);
  const removeRow = (i: number) => setRows((p) => p.filter((_, idx) => idx !== i));

  const clearAndClose = () => {
    try { localStorage.removeItem(cacheKey(supplier.id)); } catch { /* ignore */ }
    onClose();
  };

  const saveHistory = async () => {
    try {
      const branchId = await requireCurrentBranchId();
      await supabase.from("supplier_orders_history").insert({
        branch_id: branchId,
        supplier_id: supplier.id,
        order_details: JSON.parse(JSON.stringify({ rows, notes, message })),
      });
    } catch (e) {
      console.error("saveHistory failed", e);
    }
  };

  const handleWhatsapp = async () => {
    if (!hasContent || submitting) return;
    setSubmitting(true);
    const url = whatsappUrl(supplier.contact, message);
    await saveHistory();
    if (!url) {
      toast.error("לא הוגדר טלפון לספק — נשמר היסטוריה, פתח וואטסאפ ידנית");
      setSubmitting(false);
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
    toast.success("ההזמנה נשלחה והיסטוריה נשמרה");
    clearAndClose();
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      toast.success("ההזמנה הועתקה בהצלחה");
    } catch {
      toast.error("העתקה נכשלה");
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-background/85 backdrop-blur-sm grid place-items-center p-3"
      onClick={onClose}
      dir="rtl"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-card border border-border rounded-2xl p-5 space-y-4 max-h-[92vh] overflow-y-auto"
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-[10px] uppercase tracking-[0.25em] text-neon font-bold">New Order</div>
            <h3 className="font-display text-xl font-bold leading-tight">הזמנה חדשה — {supplier.name}</h3>
            <p className="text-xs text-muted-foreground">{supplier.category}</p>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 grid place-content-center rounded-md border border-border hover:text-neon shrink-0"
            aria-label="סגור"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-2">
          <div className="text-xs font-bold text-muted-foreground">מוצרים</div>
          {rows.map((r, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <input
                value={r.name}
                onChange={(e) => updateRow(i, "name", e.target.value)}
                placeholder="שם מוצר"
                className="flex-1 min-w-0 h-10 rounded-md bg-background border border-border px-2.5 text-sm focus:border-neon outline-none"
                dir="rtl"
                maxLength={120}
              />
              <input
                value={r.qty}
                onChange={(e) => updateRow(i, "qty", e.target.value)}
                placeholder="כמות"
                className="w-24 h-10 rounded-md bg-background border border-border px-2.5 text-sm focus:border-neon outline-none"
                dir="rtl"
                maxLength={40}
              />
              <button
                type="button"
                onClick={() => removeRow(i)}
                disabled={rows.length === 1}
                className="h-10 w-10 grid place-content-center rounded-md border border-border hover:border-destructive hover:text-destructive disabled:opacity-30"
                aria-label="הסר שורה"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addRow}
            className="w-full h-10 inline-flex items-center justify-center gap-1.5 rounded-md border-2 border-dashed border-border hover:border-neon hover:text-neon text-sm font-bold"
          >
            <Plus className="h-4 w-4" />
            הוסף שורה
          </button>
        </div>

        <div>
          <div className="text-xs font-bold text-muted-foreground mb-1">הערות להזמנה</div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            maxLength={400}
            placeholder="לדוגמה: למשלוח לפני 09:00"
            className="w-full rounded-md bg-background border border-border px-2.5 py-2 text-sm focus:border-neon outline-none"
            dir="rtl"
          />
        </div>

        {/* Preview */}
        <div className="rounded-md border border-border bg-background/50 p-3 text-xs whitespace-pre-wrap text-foreground/85 max-h-40 overflow-y-auto">
          {message}
        </div>

        <div className="flex flex-col sm:flex-row gap-2 pt-1">
          <button
            type="button"
            onClick={handleWhatsapp}
            disabled={!hasContent || submitting}
            className="flex-1 h-11 inline-flex items-center justify-center gap-2 rounded-md font-bold text-white bg-[#25D366] hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition"
            style={{ boxShadow: "0 0 0 0 rgba(37,211,102,0.6)" }}
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            שליחת הזמנה בוואטסאפ
          </button>
          <button
            type="button"
            onClick={handleCopy}
            disabled={!hasContent}
            className="h-11 px-4 inline-flex items-center justify-center gap-2 rounded-md border border-border hover:border-neon hover:text-neon font-bold text-sm disabled:opacity-40"
          >
            <Copy className="h-4 w-4" />
            העתק הזמנה
          </button>
        </div>
      </div>
    </div>
  );
}
