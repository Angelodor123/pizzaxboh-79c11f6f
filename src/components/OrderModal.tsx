import { useCallback, useEffect, useState } from "react";
import { X, Plus, Trash2, Copy, Send, Loader2, ChevronDown, Eye, Pencil, Image as ImageIcon, Package } from "lucide-react";
import { SupplierCatalogPicker } from "@/components/SupplierCatalogPicker";
import { SupplierCatalogManager } from "@/components/SupplierCatalogManager";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { requireCurrentBranchId } from "@/lib/current-branch";
import { compileOrderMessage, whatsappUrl, type OrderRow } from "@/lib/order-template";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type ReceivedInvoiceItem = { id: string; item_name: string; quantity: number; unit_price: number; total_price: number };
type ReceivedInvoice = {
  id: string;
  document_date: string;
  invoice_number: string;
  total_amount: number;
  invoice_image_url: string | null;
  items: ReceivedInvoiceItem[];
};

type EditableItem = { id?: string; item_name: string; quantity: string; unit_price: string; total_price: string };
type EditingInvoiceState = {
  id: string;
  document_date: string;
  invoice_number: string;
  total_amount: string;
  items: EditableItem[];
};

interface Supplier {
  id: string;
  name: string;
  category: string;
  contact: string | null;
}

interface Props {
  supplier: Supplier;
  onClose: () => void;
  onReceive?: (orderId: string) => void;
  isAdmin?: boolean;
}

const cacheKey = (id: string) => `order-draft:${id}`;

type HistoryEntry = {
  id: string;
  created_at: string;
  rows: OrderRow[];
  notes?: string;
  orderId?: string | null;
  status?: "draft" | "sent" | "received" | "cancelled" | null;
};

export function OrderModal({ supplier, onClose, onReceive, isAdmin = false }: Props) {
  const [rows, setRows] = useState<OrderRow[]>([{ name: "", qty: "" }]);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [received, setReceived] = useState<ReceivedInvoice[]>([]);
  const [receivedLoading, setReceivedLoading] = useState(true);
  const [expandedInvoiceId, setExpandedInvoiceId] = useState<string | null>(null);
  const [viewingImage, setViewingImage] = useState<{ url: string; loading: boolean } | null>(null);
  const [editingInvoice, setEditingInvoice] = useState<EditingInvoiceState | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingInvoiceId, setDeletingInvoiceId] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [catalogManagerOpen, setCatalogManagerOpen] = useState(false);

  // Load order history for this supplier — from new `orders` table (with status)
  // falling back to legacy `supplier_orders_history` when needed.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setHistoryLoading(true);
      const [ordersRes, legacyRes] = await Promise.all([
        supabase
          .from("orders")
          .select("id, sent_at, items, notes, status")
          .eq("supplier_id", supplier.id)
          .order("sent_at", { ascending: false })
          .limit(20),
        supabase
          .from("supplier_orders_history")
          .select("id, created_at, order_details")
          .eq("supplier_id", supplier.id)
          .order("created_at", { ascending: false })
          .limit(20),
      ]);
      if (cancelled) return;

      const fromOrders: HistoryEntry[] = (ordersRes.data ?? []).map((o) => {
        const items = Array.isArray(o.items) ? (o.items as unknown as OrderRow[]) : [];
        const cleanRows = items
          .filter((r) => r && (r.name?.toString().trim() || r.qty?.toString().trim()))
          .map((r) => ({ name: String(r.name ?? ""), qty: String(r.qty ?? "") }));
        return {
          id: o.id,
          created_at: o.sent_at,
          rows: cleanRows,
          notes: o.notes ?? undefined,
          orderId: o.id,
          status: (o.status as HistoryEntry["status"]) ?? null,
        };
      }).filter((h) => h.rows.length > 0);

      const fromLegacy: HistoryEntry[] = (legacyRes.data ?? []).map((row) => {
        const det = (row.order_details ?? {}) as { rows?: OrderRow[]; notes?: string };
        const cleanRows = Array.isArray(det.rows)
          ? det.rows.filter((r) => r && (r.name?.trim() || r.qty?.trim()))
          : [];
        return {
          id: row.id,
          created_at: row.created_at,
          rows: cleanRows,
          notes: det.notes,
          orderId: null,
          status: null,
        };
      }).filter((h) => h.rows.length > 0);

      // Merge, prefer new orders, dedupe by timestamp+first item name
      const seen = new Set<string>();
      const merged: HistoryEntry[] = [];
      for (const e of [...fromOrders, ...fromLegacy]) {
        const key = `${e.created_at?.slice(0, 16)}|${e.rows[0]?.name ?? ""}`;
        if (seen.has(key)) continue;
        seen.add(key);
        merged.push(e);
      }
      merged.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
      setHistory(merged.slice(0, 20));
      setHistoryLoading(false);
    })();
    return () => { cancelled = true; };
  }, [supplier.id]);

  // Load received goods (invoices + items) for this supplier
  const loadReceived = useCallback(async () => {
    setReceivedLoading(true);
    const { data: invs } = await supabase
      .from("invoices")
      .select("id, document_date, invoice_number, total_amount, invoice_image_url")
      .eq("supplier_id", supplier.id)
      .eq("is_archived", false)
      .order("document_date", { ascending: false })
      .limit(30);
    const ids = (invs ?? []).map((i) => i.id);
    const itemsByInvoice: Record<string, ReceivedInvoiceItem[]> = {};
    if (ids.length) {
      const { data: items } = await supabase
        .from("invoice_items")
        .select("id, invoice_id, item_name, quantity, unit_price, total_price, sort_order")
        .in("invoice_id", ids)
        .order("sort_order", { ascending: true });
      for (const it of items ?? []) {
        (itemsByInvoice[it.invoice_id] ||= []).push({
          id: it.id,
          item_name: it.item_name,
          quantity: Number(it.quantity ?? 0),
          unit_price: Number(it.unit_price ?? 0),
          total_price: Number(it.total_price ?? 0),
        });
      }
    }
    setReceived((invs ?? []).map((i) => ({
      id: i.id,
      document_date: i.document_date,
      invoice_number: i.invoice_number,
      total_amount: Number(i.total_amount ?? 0),
      invoice_image_url: i.invoice_image_url ?? null,
      items: itemsByInvoice[i.id] ?? [],
    })));
    setReceivedLoading(false);
  }, [supplier.id]);

  useEffect(() => { loadReceived(); }, [loadReceived]);



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

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const message = compileOrderMessage(rows, notes);
  const hasContent = rows.some((r) => r.name.trim() && r.qty.trim());

  const updateRow = (i: number, key: keyof OrderRow, v: string) =>
    setRows((p) => p.map((r, idx) => (idx === i ? { ...r, [key]: v } : r)));
  const addRow = () => setRows((p) => [...p, { name: "", qty: "" }]);
  const removeRow = (i: number) => setRows((p) => p.filter((_, idx) => idx !== i));
  const duplicateOrder = (entry: HistoryEntry) => {
    setRows(entry.rows.length ? entry.rows.map((r) => ({ name: r.name ?? "", qty: r.qty ?? "" })) : [{ name: "", qty: "" }]);
    if (typeof entry.notes === "string") setNotes(entry.notes);
    toast.success("ההזמנה שוכפלה לטופס");
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    return `${dd}/${mm}/${d.getFullYear()}`;
  };


  const clearAndClose = () => {
    try { localStorage.removeItem(cacheKey(supplier.id)); } catch { /* ignore */ }
    onClose();
  };

  const saveHistory = async () => {
    try {
      const branchId = await requireCurrentBranchId();
      const cleanRows = rows.filter((r) => r.name.trim());
      // legacy history table (kept for the history UI)
      await supabase.from("supplier_orders_history").insert({
        branch_id: branchId,
        supplier_id: supplier.id,
        order_details: JSON.parse(JSON.stringify({ rows, notes, message })),
      });
      // new orders table — drives goods-receiving matching
      await supabase.from("orders").insert({
        branch_id: branchId,
        supplier_id: supplier.id,
        status: "sent",
        items: JSON.parse(JSON.stringify(cleanRows)),
        notes: notes || null,
        message,
        sent_at: new Date().toISOString(),
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


  const openViewImage = async (inv: ReceivedInvoice) => {
    if (!inv.invoice_image_url) {
      toast.error("לא צורפה תמונה לחשבונית זו");
      return;
    }
    setViewingImage({ url: "", loading: true });
    const { data, error } = await supabase.storage
      .from("invoice-images")
      .createSignedUrl(inv.invoice_image_url, 60 * 60);
    if (error || !data?.signedUrl) {
      setViewingImage(null);
      toast.error("טעינת תמונת החשבונית נכשלה");
      return;
    }
    setViewingImage({ url: data.signedUrl, loading: false });
  };

  const openEditInvoice = (inv: ReceivedInvoice) => {
    setEditingInvoice({
      id: inv.id,
      document_date: inv.document_date,
      invoice_number: inv.invoice_number ?? "",
      total_amount: String(inv.total_amount ?? 0),
      items: inv.items.length
        ? inv.items.map((it) => ({
            id: it.id,
            item_name: it.item_name,
            quantity: String(it.quantity),
            unit_price: String(it.unit_price),
            total_price: String(it.total_price),
          }))
        : [{ item_name: "", quantity: "", unit_price: "", total_price: "" }],
    });
  };

  const updateEditItem = (idx: number, key: keyof EditableItem, value: string) => {
    setEditingInvoice((prev) => prev ? {
      ...prev,
      items: prev.items.map((it, i) => i === idx ? { ...it, [key]: value } : it),
    } : prev);
  };

  const addEditItem = () => setEditingInvoice((prev) => prev ? {
    ...prev,
    items: [...prev.items, { item_name: "", quantity: "", unit_price: "", total_price: "" }],
  } : prev);

  const removeEditItem = (idx: number) => setEditingInvoice((prev) => prev ? {
    ...prev,
    items: prev.items.filter((_, i) => i !== idx),
  } : prev);

  const saveEditInvoice = async () => {
    if (!editingInvoice) return;
    setSavingEdit(true);
    try {
      const { error: upErr } = await supabase
        .from("invoices")
        .update({
          document_date: editingInvoice.document_date,
          invoice_number: editingInvoice.invoice_number,
          total_amount: Number(editingInvoice.total_amount) || 0,
        })
        .eq("id", editingInvoice.id);
      if (upErr) throw upErr;

      const { error: delErr } = await supabase
        .from("invoice_items")
        .delete()
        .eq("invoice_id", editingInvoice.id);
      if (delErr) throw delErr;

      const cleanItems = editingInvoice.items
        .filter((it) => it.item_name.trim())
        .map((it, i) => ({
          invoice_id: editingInvoice.id,
          item_name: it.item_name.trim(),
          quantity: Number(it.quantity) || 0,
          unit_price: Number(it.unit_price) || 0,
          total_price: Number(it.total_price) || 0,
          sort_order: i,
        }));
      if (cleanItems.length) {
        const { error: insErr } = await supabase.from("invoice_items").insert(cleanItems);
        if (insErr) throw insErr;
      }

      toast.success("החשבונית עודכנה בהצלחה");
      setEditingInvoice(null);
      await loadReceived();
    } catch (e) {
      console.error(e);
      toast.error("עדכון החשבונית נכשל");
    } finally {
      setSavingEdit(false);
    }
  };

  const confirmDeleteInvoice = async () => {
    if (!deletingInvoiceId) return;
    setDeleteBusy(true);
    try {
      await supabase.from("invoice_items").delete().eq("invoice_id", deletingInvoiceId);
      const { error } = await supabase.from("invoices").delete().eq("id", deletingInvoiceId);
      if (error) throw error;
      toast.success("החשבונית נמחקה בהצלחה");
      setDeletingInvoiceId(null);
      await loadReceived();
    } catch (e) {
      console.error(e);
      toast.error("מחיקת החשבונית נכשלה");
    } finally {
      setDeleteBusy(false);
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
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => removeRow(i)}
                  disabled={rows.length === 1}
                  className="h-10 w-10 grid place-content-center rounded-md border border-border hover:border-destructive hover:text-destructive disabled:opacity-30"
                  aria-label="הסר שורה"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setCatalogOpen(true)}
              className="h-10 inline-flex items-center justify-center gap-1.5 rounded-md border-2 border-dashed border-neon/50 text-neon hover:bg-neon/10 text-sm font-bold"
            >
              <Package className="h-4 w-4" />
              בחר מהקטלוג
            </button>
            <button
              type="button"
              onClick={addRow}
              className="h-10 inline-flex items-center justify-center gap-1.5 rounded-md border-2 border-dashed border-border hover:border-neon hover:text-neon text-sm font-bold"
            >
              <Plus className="h-4 w-4" />
              הוסף שורה
            </button>
          </div>
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

        {/* Supplier History — Tabs */}
        <div className="border-t border-zinc-800/50 mt-6 pt-4">
          <Tabs defaultValue="sent" dir="rtl">
            <TabsList className="w-full grid grid-cols-2">
              <TabsTrigger value="sent">הזמנות שנשלחו</TabsTrigger>
              <TabsTrigger value="received">סחורה שהתקבלה</TabsTrigger>
            </TabsList>

            <TabsContent value="sent" className="mt-3">
              {historyLoading ? (
                <div className="flex items-center gap-2 text-xs text-zinc-500">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> טוען היסטוריה…
                </div>
              ) : history.length === 0 ? (
                <div className="text-xs text-zinc-500">אין הזמנות קודמות לספק זה.</div>
              ) : (
                <div className="max-h-64 overflow-y-auto pr-1 custom-scrollbar">
                  {history.map((h) => {
                    const summary = h.rows
                      .map((r) => `${r.name.trim()}${r.qty.trim() ? ` (${r.qty.trim()})` : ""}`)
                      .filter(Boolean)
                      .join(", ");
                    const isPending = h.status === "sent" && h.orderId;
                    return (
                      <div
                        key={h.id}
                        className="bg-zinc-900 border border-zinc-800 rounded-md p-3 mb-2 flex flex-col gap-2"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <span className="text-zinc-500">הוזמן</span>
                            {isPending && (
                              <span className="text-[10px] font-bold text-amber-brand border border-amber-brand/60 rounded px-1.5 py-0.5">
                                ממתינה לקבלה
                              </span>
                            )}
                            {h.status === "received" && (
                              <span className="text-[10px] font-bold text-success border border-success/60 rounded px-1.5 py-0.5">
                                התקבלה
                              </span>
                            )}
                          </div>
                          <span className="text-zinc-300 font-bold">{formatDate(h.created_at)}</span>
                        </div>
                        <div className="text-xs text-zinc-300 line-clamp-2">{summary}</div>
                        {isPending && onReceive ? (
                          <button
                            type="button"
                            onClick={() => { onReceive(h.orderId!); onClose(); }}
                            className="text-xs py-1.5 px-3 rounded w-fit font-bold text-white transition"
                            style={{ background: "linear-gradient(135deg, #ff2db4, #ff5ec0)", boxShadow: "0 0 14px rgba(255,45,180,0.45)" }}
                          >
                            קבל סחורה
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => duplicateOrder(h)}
                            className="bg-zinc-800 hover:bg-zinc-700 text-pink-500 text-xs py-1 px-3 rounded w-fit transition-colors"
                          >
                            שכפל הזמנה
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            <TabsContent value="received" className="mt-3">
              {receivedLoading ? (
                <div className="flex items-center gap-2 text-xs text-zinc-500">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> טוען סחורה שהתקבלה…
                </div>
              ) : received.length === 0 ? (
                <div className="text-xs text-zinc-500">לא נרשמו קבלות סחורה לספק זה.</div>
              ) : (
                <div className="max-h-64 overflow-y-auto pr-1 custom-scrollbar space-y-2">
                  {received.map((inv) => {
                    const open = expandedInvoiceId === inv.id;
                    return (
                      <div key={inv.id} className="bg-zinc-900 border border-zinc-800 rounded-md overflow-hidden">
                        <button
                          type="button"
                          onClick={() => setExpandedInvoiceId(open ? null : inv.id)}
                          className="w-full p-3 flex items-center justify-between gap-2 text-right hover:bg-zinc-800/60 transition"
                        >
                          <div className="flex flex-col gap-0.5 min-w-0">
                            <div className="text-xs text-zinc-500">
                              חשבונית {inv.invoice_number || "—"}
                            </div>
                            <div className="text-xs text-zinc-300 font-bold tabular-nums">
                              {formatDate(inv.document_date)} · ₪{inv.total_amount.toLocaleString("he-IL", { maximumFractionDigits: 2 })}
                            </div>
                          </div>
                          <ChevronDown className={`h-4 w-4 text-zinc-400 transition-transform ${open ? "rotate-180" : ""}`} />
                        </button>
                        {open && (
                          <div className="border-t border-zinc-800 p-3 bg-zinc-950/40 space-y-3">
                            {inv.items.length === 0 ? (
                              <div className="text-xs text-zinc-500">אין פריטים שמורים לחשבונית זו.</div>
                            ) : (
                              <div className="space-y-1.5">
                                <div className="grid grid-cols-[1fr_56px_72px] text-[10px] font-bold text-zinc-500 px-1">
                                  <span>פריט</span>
                                  <span className="text-center">כמות</span>
                                  <span className="text-center">סה"כ</span>
                                </div>
                                {inv.items.map((it) => (
                                  <div key={it.id} className="grid grid-cols-[1fr_56px_72px] text-xs text-zinc-300 items-center px-1 py-1 rounded bg-zinc-900/60">
                                    <span className="truncate">{it.item_name}</span>
                                    <span className="text-center tabular-nums">{it.quantity}</span>
                                    <span className="text-center tabular-nums font-bold">₪{it.total_price.toLocaleString("he-IL", { maximumFractionDigits: 2 })}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                            <div className="flex flex-wrap gap-2 pt-2 border-t border-zinc-800">
                              <button
                                type="button"
                                onClick={() => openViewImage(inv)}
                                disabled={!inv.invoice_image_url}
                                className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded border border-border hover:border-neon hover:text-neon disabled:opacity-40 disabled:cursor-not-allowed transition"
                              >
                                <Eye className="h-3.5 w-3.5" />
                                צפה בחשבונית
                              </button>
                              <button
                                type="button"
                                onClick={() => openEditInvoice(inv)}
                                className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded border border-border hover:border-amber-brand hover:text-amber-brand transition"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                                ערוך
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeletingInvoiceId(inv.id)}
                                className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded border border-destructive/60 text-destructive hover:bg-destructive/10 transition"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                מחק
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>

      </div>

      {/* View invoice image */}
      <Dialog open={!!viewingImage} onOpenChange={(o) => !o && setViewingImage(null)}>
        <DialogContent className="max-w-3xl" dir="rtl">
          <DialogHeader>
            <DialogTitle>תמונת חשבונית</DialogTitle>
          </DialogHeader>
          <div className="max-h-[70vh] overflow-auto grid place-items-center bg-zinc-950 rounded-md">
            {viewingImage?.loading ? (
              <div className="flex items-center gap-2 text-sm text-zinc-400 p-12">
                <Loader2 className="h-4 w-4 animate-spin" /> טוען…
              </div>
            ) : viewingImage?.url ? (
              <img src={viewingImage.url} alt="חשבונית" className="max-w-full h-auto" />
            ) : (
              <div className="p-12 text-sm text-zinc-400 flex items-center gap-2">
                <ImageIcon className="h-4 w-4" /> אין תמונה זמינה
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit invoice */}
      <Dialog open={!!editingInvoice} onOpenChange={(o) => !o && !savingEdit && setEditingInvoice(null)}>
        <DialogContent className="max-w-2xl" dir="rtl">
          <DialogHeader>
            <DialogTitle>עריכת חשבונית</DialogTitle>
          </DialogHeader>
          {editingInvoice && (
            <div className="space-y-3 max-h-[70vh] overflow-y-auto pl-1">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-muted-foreground">תאריך</label>
                  <input
                    type="date"
                    value={editingInvoice.document_date?.slice(0, 10) ?? ""}
                    onChange={(e) => setEditingInvoice((p) => p ? { ...p, document_date: e.target.value } : p)}
                    className="w-full h-9 rounded-md bg-background border border-border px-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-muted-foreground">מס׳ חשבונית</label>
                  <input
                    value={editingInvoice.invoice_number}
                    onChange={(e) => setEditingInvoice((p) => p ? { ...p, invoice_number: e.target.value } : p)}
                    className="w-full h-9 rounded-md bg-background border border-border px-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-muted-foreground">סה"כ</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={editingInvoice.total_amount}
                    onChange={(e) => setEditingInvoice((p) => p ? { ...p, total_amount: e.target.value } : p)}
                    className="w-full h-9 rounded-md bg-background border border-border px-2 text-sm tabular-nums"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="text-xs font-bold text-muted-foreground">פריטים</div>
                {editingInvoice.items.map((it, i) => (
                  <div key={i} className="grid grid-cols-[1fr_70px_80px_80px_36px] gap-1.5 items-center">
                    <input
                      placeholder="פריט"
                      value={it.item_name}
                      onChange={(e) => updateEditItem(i, "item_name", e.target.value)}
                      className="h-9 rounded-md bg-background border border-border px-2 text-xs"
                    />
                    <input
                      placeholder="כמות"
                      type="number"
                      inputMode="decimal"
                      value={it.quantity}
                      onChange={(e) => updateEditItem(i, "quantity", e.target.value)}
                      className="h-9 rounded-md bg-background border border-border px-2 text-xs text-center tabular-nums"
                    />
                    <input
                      placeholder="יח׳"
                      type="number"
                      inputMode="decimal"
                      value={it.unit_price}
                      onChange={(e) => updateEditItem(i, "unit_price", e.target.value)}
                      className="h-9 rounded-md bg-background border border-border px-2 text-xs text-center tabular-nums"
                    />
                    <input
                      placeholder='סה"כ'
                      type="number"
                      inputMode="decimal"
                      value={it.total_price}
                      onChange={(e) => updateEditItem(i, "total_price", e.target.value)}
                      className="h-9 rounded-md bg-background border border-border px-2 text-xs text-center tabular-nums"
                    />
                    <button
                      type="button"
                      onClick={() => removeEditItem(i)}
                      className="h-9 w-9 grid place-content-center rounded-md border border-border hover:border-destructive hover:text-destructive"
                      aria-label="הסר"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addEditItem}
                  className="w-full h-9 inline-flex items-center justify-center gap-1.5 rounded-md border-2 border-dashed border-border hover:border-neon hover:text-neon text-xs font-bold"
                >
                  <Plus className="h-3.5 w-3.5" /> הוסף פריט
                </button>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-2">
            <button
              type="button"
              onClick={() => setEditingInvoice(null)}
              disabled={savingEdit}
              className="h-10 px-4 rounded-md border border-border hover:text-neon text-sm font-bold"
            >
              ביטול
            </button>
            <button
              type="button"
              onClick={saveEditInvoice}
              disabled={savingEdit}
              className="h-10 px-5 rounded-md bg-neon text-black text-sm font-bold inline-flex items-center gap-2 disabled:opacity-50"
            >
              {savingEdit && <Loader2 className="h-4 w-4 animate-spin" />}
              שמור שינויים
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deletingInvoiceId} onOpenChange={(o) => !o && !deleteBusy && setDeletingInvoiceId(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>מחיקת חשבונית</AlertDialogTitle>
            <AlertDialogDescription>
              האם אתה בטוח שברצונך למחוק חשבונית זו לצמיתות?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteBusy}>ביטול</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); confirmDeleteInvoice(); }}
              disabled={deleteBusy}
              className="bg-destructive hover:bg-destructive/90"
            >
              {deleteBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : "מחק לצמיתות"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {catalogOpen && (
        <SupplierCatalogPicker
          supplierId={supplier.id}
          supplierName={supplier.name}
          open={catalogOpen}
          onClose={() => setCatalogOpen(false)}
          onAdd={(newRows) => {
            setRows((prev) => {
              const cleaned = prev.filter((r) => r.name.trim() || r.qty.trim());
              return [...cleaned, ...newRows];
            });
          }}
          onAddNewProduct={() => {
            // Close the picker first to avoid nested-dialog stacking, then open the manager.
            setCatalogOpen(false);
            setCatalogManagerOpen(true);
          }}
        />
      )}
      {catalogManagerOpen && (
        <SupplierCatalogManager
          supplierId={supplier.id}
          supplierName={supplier.name}
          open={catalogManagerOpen}
          onClose={() => {
            setCatalogManagerOpen(false);
            // Re-open the picker so the user lands back where they were, with fresh data.
            setCatalogOpen(true);
          }}
        />
      )}
    </div>
  );
}
