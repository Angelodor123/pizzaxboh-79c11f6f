import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Minus, Image as ImageIcon, AlertTriangle, Search, Check } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { requireCurrentBranchId } from "@/lib/current-branch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { loadSupplierProducts, fuzzyMatch, type SupplierProduct } from "@/lib/supplier-products";
import type { OrderRow } from "@/lib/order-template";

interface Props {
  supplierId: string;
  supplierName: string;
  open: boolean;
  onClose: () => void;
  /** Called with rows to append to the current order. */
  onAdd: (rows: OrderRow[]) => void;
}

type ShortageRow = { id: string; name: string; quantity: number; unit: string };

export function SupplierCatalogPicker({ supplierId, supplierName, open, onClose, onAdd }: Props) {
  const [products, setProducts] = useState<SupplierProduct[]>([]);
  const [shortages, setShortages] = useState<ShortageRow[]>([]);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const branchId = await requireCurrentBranchId();
        const [prods, shortRes] = await Promise.all([
          loadSupplierProducts(supplierId),
          supabase
            .from("shortage_items")
            .select("id, name, quantity, unit")
            .eq("branch_id", branchId)
            .eq("completed", false),
        ]);
        if (cancelled) return;
        setProducts(prods);
        const sh = (shortRes.data ?? []) as ShortageRow[];
        setShortages(sh);

        // Auto-match: pre-fill qty for products matching open shortages.
        const initial: Record<string, number> = {};
        for (const p of prods) {
          const match = sh.find((s) => fuzzyMatch(p.name, s.name));
          if (match) {
            initial[p.id] = Math.max(Number(match.quantity) || 0, p.default_qty || 1);
          }
        }
        setQty(initial);
      } catch (e: any) {
        toast.error("טעינה נכשלה: " + (e?.message ?? ""));
      } finally {
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, supplierId]);

  const shortageByProduct = useMemo(() => {
    const map = new Map<string, ShortageRow>();
    for (const p of products) {
      const match = shortages.find((s) => fuzzyMatch(p.name, s.name));
      if (match) map.set(p.id, match);
    }
    return map;
  }, [products, shortages]);

  const matchedIds = useMemo(() => new Set(shortageByProduct.keys()), [shortageByProduct]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) =>
      p.name.toLowerCase().includes(q) ||
      (p.sku ?? "").toLowerCase().includes(q) ||
      (p.category ?? "").toLowerCase().includes(q),
    );
  }, [products, search]);

  const setQ = (id: string, v: number) => {
    setQty((m) => {
      const next = { ...m };
      if (v <= 0) delete next[id]; else next[id] = v;
      return next;
    });
  };

  const inc = (p: SupplierProduct) => setQ(p.id, (qty[p.id] ?? 0) + (p.default_qty || 1));
  const dec = (p: SupplierProduct) => setQ(p.id, Math.max(0, (qty[p.id] ?? 0) - (p.default_qty || 1)));

  const selectedCount = Object.values(qty).filter((v) => v > 0).length;
  const unmatchedShortages = useMemo(() => {
    return shortages.filter((s) => !products.some((p) => fuzzyMatch(p.name, s.name)));
  }, [shortages, products]);

  const handleAdd = () => {
    const rows: OrderRow[] = [];
    for (const p of products) {
      const q = qty[p.id];
      if (!q || q <= 0) continue;
      const qtyStr = p.unit ? `${q} ${p.unit}` : String(q);
      rows.push({ name: p.name, qty: qtyStr });
    }
    // Also add unmatched shortages as free-text rows, so the user doesn't lose them.
    for (const s of unmatchedShortages) {
      const qtyStr = s.unit ? `${s.quantity} ${s.unit}` : String(s.quantity);
      rows.push({ name: s.name, qty: qtyStr });
    }
    if (!rows.length) {
      toast.error("בחר לפחות מוצר אחד");
      return;
    }
    onAdd(rows);
    toast.success(`נוספו ${rows.length} פריטים להזמנה`);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">📦 בחירה מהקטלוג — {supplierName}</DialogTitle>
        </DialogHeader>

        {/* Shortage banner */}
        {shortages.length > 0 && (
          <div className="rounded-lg border border-amber-brand/40 bg-amber-brand/10 p-3 text-xs flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-brand shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-bold text-amber-brand">
                התאמת חוסרים — {matchedIds.size} מתוך {shortages.length} זוהו אוטומטית והכמות מולאה.
              </div>
              {unmatchedShortages.length > 0 && (
                <div className="text-muted-foreground">
                  חוסרים לא תואמים יתווספו כשורות חופשיות: {unmatchedShortages.map((s) => s.name).join(", ")}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Search */}
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="חיפוש לפי SKU / שם מוצר…"
            className="w-full h-10 rounded-md bg-background border border-border pr-9 pl-3 text-sm focus:border-neon outline-none"
          />
        </div>

        {loading ? (
          <div className="text-sm text-muted-foreground py-12 text-center flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> טוען קטלוג…
          </div>
        ) : visible.length === 0 ? (
          <div className="text-sm text-muted-foreground py-12 text-center border border-dashed border-border rounded-xl">
            {products.length === 0
              ? "אין מוצרים בקטלוג של ספק זה. הוסף מוצרים דרך ניהול הספקים."
              : "לא נמצאו מוצרים התואמים לחיפוש."}
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {visible.map((p) => {
              const q = qty[p.id] ?? 0;
              const shortage = shortageByProduct.get(p.id);
              const isMatch = !!shortage;
              return (
                <div
                  key={p.id}
                  className={`relative border rounded-lg p-2 flex items-center gap-3 bg-background/30 ${
                    q > 0 ? "border-neon shadow-[0_0_0_1px_var(--color-neon)]" : isMatch ? "border-amber-brand/60" : "border-border"
                  }`}
                >
                  <div className="relative h-16 w-16 shrink-0 rounded-md bg-zinc-900/60 grid place-items-center overflow-hidden">
                    {p.image_url ? (
                      <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon className="h-7 w-7 text-zinc-700" />
                    )}
                    {isMatch && (
                      <span className="absolute top-0.5 right-0.5 text-[9px] font-bold bg-amber-brand text-black rounded px-1 py-0.5">
                        חוסר
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold leading-tight line-clamp-2">{p.name}</div>
                    {p.sku && <div className="text-[11px] text-muted-foreground tabular-nums">{p.sku}</div>}
                    <div className="text-[11px] text-muted-foreground">
                      {p.unit_size || p.unit}
                      {p.price != null && <> · <span className="text-foreground/80">₪{p.price}</span></>}
                    </div>
                    {shortage && (
                      <div className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold bg-amber-brand/15 text-amber-brand border border-amber-brand/40 rounded px-1.5 py-0.5">
                        <AlertTriangle className="h-3 w-3" />
                        חסרות {shortage.quantity}
                        {shortage.unit ? ` ${shortage.unit}` : ""} ברשימת החוסרים
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => dec(p)}
                      disabled={q <= 0}
                      className="h-8 w-8 grid place-content-center rounded border border-border hover:border-neon hover:text-neon disabled:opacity-30"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <input
                      value={q || ""}
                      onChange={(e) => setQ(p.id, Math.max(0, Number(e.target.value) || 0))}
                      placeholder="0"
                      inputMode="decimal"
                      className="w-12 h-8 rounded border border-border bg-background text-center text-sm focus:border-neon outline-none"
                    />
                    <button
                      onClick={() => inc(p)}
                      className="h-8 w-8 grid place-content-center rounded border border-border hover:border-neon hover:text-neon"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  {q > 0 && (
                    <span className="absolute -top-1.5 -left-1.5 text-[10px] font-bold bg-neon text-black rounded-full h-5 min-w-5 px-1.5 grid place-content-center">
                      <Check className="h-3 w-3" />
                    </span>
                  )}
                </div>
              );
            })}
          </div>

        )}

        <div className="sticky bottom-0 -mx-6 px-6 pt-3 pb-1 bg-card border-t border-border flex items-center justify-between">
          <div className="text-xs text-muted-foreground">
            נבחרו {selectedCount} מוצרים
            {unmatchedShortages.length > 0 && ` + ${unmatchedShortages.length} חוסרים חופשיים`}
          </div>
          <button
            onClick={handleAdd}
            disabled={selectedCount === 0 && unmatchedShortages.length === 0}
            className="h-10 px-5 inline-flex items-center gap-2 rounded-md bg-neon text-black font-bold text-sm disabled:opacity-40"
          >
            <Plus className="h-4 w-4" />
            הוסף להזמנה
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
