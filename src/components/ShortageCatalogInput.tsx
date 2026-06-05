import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Search, Plus, X, Check, Package } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { requireCurrentBranchId } from "@/lib/current-branch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type CatalogMatch = {
  id: string;
  name: string;
  unit: string;
  supplier_id: string;
  supplier_name: string;
  image_url: string | null;
  cost_price: number | null;
};

type Supplier = { id: string; name: string };

interface Props {
  /** Called when a catalog item is selected and quantity confirmed. */
  onSubmit: (data: {
    catalogProductId: string;
    text: string;
    unit: string;
    currentStock: number;
    urgent: boolean;
  }) => Promise<void> | void;
  placeholder?: string;
}

/**
 * Search-only input for the shortages list. The user MUST pick from the
 * supplier catalog (or quick-add a new product). Free text is not allowed.
 */
export function ShortageCatalogInput({ onSubmit, placeholder }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CatalogMatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<CatalogMatch | null>(null);
  const [stock, setStock] = useState<string>("");
  const [urgent, setUrgent] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const debounceRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Click-outside to close dropdown
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  // Debounced search
  useEffect(() => {
    if (selected) return;
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    const q = query.trim();
    if (q.length < 1) {
      setResults([]);
      return;
    }
    debounceRef.current = window.setTimeout(async () => {
      setLoading(true);
      try {
        const branchId = await requireCurrentBranchId();
        const { data, error } = await supabase
          .from("supplier_products")
          .select("id, name, unit, supplier_id, image_url, cost_price, expected_price, price, suppliers!inner(name)")
          .eq("branch_id", branchId)
          .eq("active", true)
          .ilike("name", `%${q}%`)
          .order("name", { ascending: true })
          .limit(15);
        if (error) throw error;
        const rows: CatalogMatch[] = (data ?? []).map((r: any) => ({
          id: r.id,
          name: r.name,
          unit: r.unit,
          supplier_id: r.supplier_id,
          supplier_name: r.suppliers?.name ?? "—",
          image_url: r.image_url,
          cost_price: r.cost_price ?? r.expected_price ?? r.price ?? null,
        }));
        setResults(rows);
      } catch (e: any) {
        toast.error("חיפוש נכשל: " + (e?.message ?? ""));
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [query, selected]);

  const handleSelect = (m: CatalogMatch) => {
    setSelected(m);
    setQuery(m.name);
    setResults([]);
    setOpen(false);
    setStock("");
  };

  const handleClear = () => {
    setSelected(null);
    setQuery("");
    setStock("");
    setUrgent(false);
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!selected) {
      toast.error("בחר פריט מהקטלוג");
      return;
    }
    const stockNum = stock === "" ? 0 : Number(stock);
    if (Number.isNaN(stockNum) || stockNum < 0) {
      toast.error("הזן כמות תקינה");
      return;
    }
    const text = `${selected.name} · יש ${stockNum} ${selected.unit}`.trim();
    await onSubmit({
      catalogProductId: selected.id,
      text,
      unit: selected.unit,
      currentStock: stockNum,
      urgent,
    });
    handleClear();
  };

  const handleQuickAdded = (created: CatalogMatch) => {
    setQuickAddOpen(false);
    handleSelect(created);
  };

  return (
    <>
      <div ref={containerRef} className="relative">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelected(null);
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
              placeholder={placeholder ?? "חפש פריט בקטלוג…"}
              dir="rtl"
              maxLength={120}
              aria-label="חפש פריט בקטלוג ספקים"
              className={`w-full bg-input border rounded-md pr-9 pl-3 py-2 text-sm text-right focus:outline-none focus:ring-2 focus:ring-neon/60 focus:border-neon ${
                selected ? "border-neon" : "border-border"
              }`}
            />
            {selected && (
              <button
                type="button"
                onClick={handleClear}
                className="absolute left-2 top-1/2 -translate-y-1/2 p-1 rounded text-muted-foreground hover:text-destructive"
                aria-label="נקה בחירה"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {selected && (
            <>
              <input
                value={stock}
                onChange={(e) => setStock(e.target.value)}
                placeholder="0"
                inputMode="decimal"
                aria-label={`כמות נוכחית ב${selected.unit}`}
                className="w-16 shrink-0 bg-input border border-border rounded-md px-2 py-2 text-sm text-center tabular-nums focus:outline-none focus:ring-2 focus:ring-neon/60 focus:border-neon"
              />
              <span className="shrink-0 self-center text-[11px] text-muted-foreground min-w-8 text-center">
                {selected.unit}
              </span>
            </>
          )}

          <button
            type="submit"
            disabled={!selected}
            aria-label="הוסף לרשימת חוסרים"
            className="shrink-0 inline-flex items-center justify-center h-10 w-10 rounded-md bg-neon text-primary-foreground glow-neon disabled:opacity-40 disabled:glow-none active:scale-95 transition"
          >
            <Plus className="h-5 w-5" />
          </button>
        </form>

        {/* Dropdown */}
        {open && !selected && query.trim().length > 0 && (
          <div className="absolute z-30 mt-1 w-full bg-popover border border-border rounded-md shadow-lg max-h-72 overflow-y-auto">
            {loading ? (
              <div className="p-4 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> מחפש…
              </div>
            ) : results.length === 0 ? (
              <div className="p-3 text-center space-y-2">
                <div className="text-xs text-muted-foreground">
                  לא נמצאו פריטים בקטלוג עבור "{query.trim()}"
                </div>
                <button
                  type="button"
                  onClick={() => setQuickAddOpen(true)}
                  className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-md bg-neon/15 text-neon border border-neon/40 hover:bg-neon/25 active:scale-95 transition"
                >
                  <Plus className="h-3.5 w-3.5" />
                  הוסף "{query.trim()}" לקטלוג
                </button>
              </div>
            ) : (
              <ul className="divide-y divide-border/60">
                {results.map((r) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => handleSelect(r)}
                      className="w-full text-right px-3 py-2 hover:bg-accent/50 active:bg-accent transition flex items-center gap-2"
                    >
                      <div className="h-9 w-9 shrink-0 rounded bg-zinc-900/60 grid place-items-center overflow-hidden">
                        {r.image_url ? (
                          <img src={r.image_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <Package className="h-4 w-4 text-zinc-600" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold leading-tight line-clamp-1">{r.name}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {r.supplier_name} · {r.unit}
                        </div>
                      </div>
                    </button>
                  </li>
                ))}
                <li className="px-3 py-2 border-t border-border/60">
                  <button
                    type="button"
                    onClick={() => setQuickAddOpen(true)}
                    className="w-full text-right text-xs text-muted-foreground hover:text-neon flex items-center gap-1.5"
                  >
                    <Plus className="h-3 w-3" />
                    לא מצאתי — הוסף חדש לקטלוג
                  </button>
                </li>
              </ul>
            )}
          </div>
        )}
      </div>

      {/* Urgent toggle row when item selected */}
      {selected && (
        <div className="mt-2 space-y-1.5">
          <div className="flex items-center justify-between gap-2 px-1">
            <button
              type="button"
              onClick={() => setUrgent((u) => !u)}
              aria-pressed={urgent}
              className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-md border transition ${
                urgent
                  ? "bg-neon/15 border-neon text-neon"
                  : "border-border text-muted-foreground hover:border-neon/60"
              }`}
            >
              🔥 {urgent ? "מסומן כדחוף" : "סמן כדחוף"}
            </button>
            <div className="text-[11px] text-muted-foreground">
              ספק: <span className="text-foreground font-bold">{selected.supplier_name}</span>
            </div>
          </div>
          {selected.cost_price != null && selected.cost_price > 0 && (() => {
            const qty = Number(stock) || 0;
            const loss = qty * selected.cost_price;
            return (
              <div className="px-1 flex items-center justify-between text-[11px] rounded-md border border-amber-brand/40 bg-amber-brand/5 py-1.5 px-2">
                <span className="text-muted-foreground">
                  עלות יחידה: <span className="text-foreground font-bold tabular-nums">₪{selected.cost_price.toFixed(2)}</span>
                </span>
                {qty > 0 && (
                  <span className="font-bold text-amber-brand tabular-nums">
                    הפסד משוער: ₪{loss.toFixed(2)}
                  </span>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {quickAddOpen && (
        <QuickAddCatalogDialog
          initialName={query.trim()}
          onClose={() => setQuickAddOpen(false)}
          onCreated={handleQuickAdded}
        />
      )}
    </>
  );
}

// ============================================================
// Quick-add dialog: minimal fields to create a supplier_product
// ============================================================

const CATEGORY_OPTIONS = [
  "ירקות",
  "חלבי",
  "יבשים",
  "אריזות",
  "בשר",
  "ניקיון ותחזוקה",
];

const UNIT_OPTIONS = ['ק"ג', "גרם", "ליטר", 'מ"ל', "יח'", "ארגז", "פחית", "בקבוק"];

function QuickAddCatalogDialog({
  initialName,
  onClose,
  onCreated,
}: {
  initialName: string;
  onClose: () => void;
  onCreated: (item: CatalogMatch) => void;
}) {
  const [name, setName] = useState(initialName);
  const [supplierId, setSupplierId] = useState("");
  const [unit, setUnit] = useState("יח'");
  const [category, setCategory] = useState("");
  const [sku, setSku] = useState("");
  const [expectedPrice, setExpectedPrice] = useState("");
  const [minStockAlert, setMinStockAlert] = useState("");
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void (async () => {
      const branchId = await requireCurrentBranchId();
      const { data } = await supabase
        .from("suppliers")
        .select("id, name")
        .eq("branch_id", branchId)
        .eq("active", true)
        .order("name", { ascending: true });
      setSuppliers((data ?? []) as Supplier[]);
    })();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) return toast.error("שם פריט חובה");
    if (!category) return toast.error("בחר קטגוריה");
    if (!supplierId) return toast.error("בחר ספק");
    if (!unit.trim()) return toast.error("בחר יחידה");
    const expectedNum = expectedPrice === "" ? null : Number(expectedPrice);
    const minStockNum = minStockAlert === "" ? null : Number(minStockAlert);
    if (expectedNum !== null && (Number.isNaN(expectedNum) || expectedNum < 0))
      return toast.error("מחיר משוער לא תקין");
    if (minStockNum !== null && (Number.isNaN(minStockNum) || minStockNum < 0))
      return toast.error("התרעת מלאי לא תקינה");
    setSaving(true);
    try {
      const branchId = await requireCurrentBranchId();
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("supplier_products")
        .insert({
          branch_id: branchId,
          supplier_id: supplierId,
          name: cleanName,
          unit: unit.trim(),
          category,
          sku: sku.trim() || null,
          expected_price: expectedNum,
          cost_price: expectedNum,
          price: expectedNum,
          min_stock_alert: minStockNum,
          default_qty: 1,
          active: true,
          created_by: user?.id,
        } as any)
        .select("id, name, unit, supplier_id, image_url, cost_price")
        .single();
      if (error) throw error;
      const supplier = suppliers.find((s) => s.id === supplierId);
      toast.success("הפריט נוסף לקטלוג");
      onCreated({
        id: data.id,
        name: data.name,
        unit: data.unit,
        supplier_id: data.supplier_id,
        supplier_name: supplier?.name ?? "—",
        image_url: data.image_url,
        cost_price: (data as any).cost_price ?? expectedNum,
      });
    } catch (e: any) {
      toast.error("שמירה נכשלה: " + (e?.message ?? ""));
    } finally {
      setSaving(false);
    }
  };

  const inputCls =
    "w-full h-10 bg-input border border-border rounded-md px-3 text-sm text-right focus:outline-none focus:ring-2 focus:ring-neon/60 focus:border-neon";
  const labelCls = "block text-xs font-bold text-muted-foreground mb-1";
  const triggerCls =
    "w-full h-10 bg-input border-border rounded-md px-3 text-sm text-right focus:ring-2 focus:ring-neon/60 focus:border-neon";

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent dir="rtl" className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">➕ פריט חדש לקטלוג</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          {/* Full width: name */}
          <div>
            <label className={labelCls}>שם פריט</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              dir="rtl"
              maxLength={120}
              className={inputCls}
            />
          </div>

          {/* Full width: category */}
          <div>
            <label className={labelCls}>קטגוריה</label>
            <Select value={category} onValueChange={setCategory} dir="rtl">
              <SelectTrigger className={triggerCls}>
                <SelectValue placeholder="בחר קטגוריה…" />
              </SelectTrigger>
              <SelectContent dir="rtl">
                {CATEGORY_OPTIONS.map((c) => (
                  <SelectItem key={c} value={c} className="text-right">{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 2-col row: supplier + unit */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>ספק</label>
              <Select value={supplierId} onValueChange={setSupplierId} dir="rtl">
                <SelectTrigger className={triggerCls}>
                  <SelectValue placeholder="בחר ספק…" />
                </SelectTrigger>
                <SelectContent dir="rtl">
                  {suppliers.map((s) => (
                    <SelectItem key={s.id} value={s.id} className="text-right">{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className={labelCls}>יחידת מידה</label>
              <Select value={unit} onValueChange={setUnit} dir="rtl">
                <SelectTrigger className={triggerCls}>
                  <SelectValue placeholder="בחר יחידה…" />
                </SelectTrigger>
                <SelectContent dir="rtl">
                  {UNIT_OPTIONS.map((u) => (
                    <SelectItem key={u} value={u} className="text-right">{u}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* 2-col row: sku + expected price */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>מק"ט ספק</label>
              <input
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                dir="rtl"
                maxLength={64}
                placeholder="—"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>מחיר משוער ₪</label>
              <input
                value={expectedPrice}
                onChange={(e) => setExpectedPrice(e.target.value)}
                inputMode="decimal"
                placeholder="0.00"
                className={`${inputCls} tabular-nums`}
              />
            </div>
          </div>

          {/* Full width: min stock alert */}
          <div>
            <label className={labelCls}>התרעת מלאי מינימום</label>
            <input
              value={minStockAlert}
              onChange={(e) => setMinStockAlert(e.target.value)}
              inputMode="decimal"
              placeholder={`כמות מינ׳ ב${unit}`}
              className={`${inputCls} tabular-nums`}
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-10 rounded-md border border-border text-sm hover:bg-accent"
            >
              ביטול
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 h-10 rounded-md bg-neon text-primary-foreground font-bold text-sm glow-neon disabled:opacity-40 inline-flex items-center justify-center gap-2"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              שמור
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

