import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/inventory-audit")({
  component: InventoryAuditPage,
  head: () => ({
    meta: [
      { title: "דו״ח פערי קליטה — Inventory Audit" },
      { name: "description", content: "מעקב פערים בקליטת סחורה: פריטים חסרים, פגומים ולא מוזמנים, פר ספק." },
    ],
  }),
});

type ReasonKey = "missing" | "damaged" | "unexpected_item" | "partial";

type ExceptionRow = {
  id: string;
  product_name: string;
  expected_qty: number | null;
  actual_qty: number | null;
  reason: ReasonKey;
  resolved: boolean;
  resolved_at: string | null;
  notes: string | null;
  created_at: string;
  supplier_id: string | null;
  invoice_id: string | null;
  order_id: string | null;
};

const REASON_LABEL: Record<ReasonKey, string> = {
  missing: "חסר",
  damaged: "פגום",
  unexpected_item: "לא מוזמן",
  partial: "חלקי",
};

const REASON_STYLE: Record<ReasonKey, string> = {
  missing: "bg-red-500/15 text-red-400 border-red-500/40",
  damaged: "bg-red-500/15 text-red-400 border-red-500/40",
  partial: "bg-amber-brand/15 text-amber-brand border-amber-brand/40",
  unexpected_item: "bg-amber-brand/15 text-amber-brand border-amber-brand/40",
};

function InventoryAuditPage() {
  const [rows, setRows] = useState<ExceptionRow[]>([]);
  const [suppliers, setSuppliers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"open" | "all">("open");

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("delivery_exceptions")
      .select("id,product_name,expected_qty,actual_qty,reason,resolved,resolved_at,notes,created_at,supplier_id,invoice_id,order_id")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) {
      toast.error("שגיאה בטעינת דו״ח הפערים");
      setLoading(false);
      return;
    }
    setRows((data || []) as ExceptionRow[]);
    const ids = Array.from(new Set((data || []).map((r) => r.supplier_id).filter(Boolean) as string[]));
    if (ids.length) {
      const { data: sup } = await supabase.from("suppliers").select("id,name").in("id", ids);
      const map: Record<string, string> = {};
      (sup || []).forEach((s) => { map[s.id] = s.name; });
      setSuppliers(map);
    }
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const toggleResolved = async (row: ExceptionRow) => {
    const next = !row.resolved;
    const { error } = await supabase
      .from("delivery_exceptions")
      .update({ resolved: next, resolved_at: next ? new Date().toISOString() : null })
      .eq("id", row.id);
    if (error) { toast.error("עדכון נכשל"); return; }
    setRows((p) => p.map((r) => r.id === row.id ? { ...r, resolved: next, resolved_at: next ? new Date().toISOString() : null } : r));
    toast.success(next ? "סומן כטופל" : "סומן כלא טופל");
  };

  const visible = useMemo(() => rows.filter((r) => filter === "all" || !r.resolved), [rows, filter]);

  // Aggregate per supplier for the summary header
  const perSupplier = useMemo(() => {
    const map = new Map<string, { total: number; open: number }>();
    for (const r of rows) {
      const key = r.supplier_id ?? "unknown";
      const cur = map.get(key) ?? { total: 0, open: 0 };
      cur.total += 1;
      if (!r.resolved) cur.open += 1;
      map.set(key, cur);
    }
    return Array.from(map.entries())
      .map(([id, v]) => ({ id, name: suppliers[id] ?? "ספק לא ידוע", ...v }))
      .sort((a, b) => b.open - a.open);
  }, [rows, suppliers]);

  return (
    <div dir="rtl" className="min-h-screen bg-background text-foreground">
      <div className="max-w-4xl mx-auto p-4 space-y-5">
        <div className="flex items-center justify-between gap-3">
          <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-neon">
            <ArrowRight className="h-4 w-4" /> חזרה
          </Link>
          <button onClick={load} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-border hover:border-neon hover:text-neon text-xs font-bold">
            <RefreshCw className="h-3.5 w-3.5" /> רענן
          </button>
        </div>

        <div>
          <div className="text-[10px] uppercase tracking-[0.25em] text-neon font-bold">Inventory Audit Report</div>
          <h1 className="font-display text-2xl font-bold">דו״ח פערי קליטת סחורה</h1>
          <p className="text-xs text-muted-foreground mt-1">
            פריטים חסרים, פגומים ולא מוזמנים — לפי ספק ולפי תאריך. סמן ✓ כשהזיכוי התקבל.
          </p>
        </div>

        {/* Summary per supplier */}
        {perSupplier.length > 0 && (
          <div className="rounded-xl border border-border bg-card p-3">
            <div className="text-xs font-bold text-muted-foreground mb-2">סיכום פר ספק</div>
            <div className="flex flex-wrap gap-2">
              {perSupplier.map((s) => (
                <div key={s.id} className="px-3 py-1.5 rounded-md border border-border bg-background text-xs flex items-center gap-2">
                  <span className="font-bold">{s.name}</span>
                  <span className="tabular-nums text-muted-foreground">{s.total}</span>
                  {s.open > 0 && <span className="tabular-nums text-red-400 font-bold">· {s.open} פתוחים</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Filter */}
        <div className="flex items-center gap-2 text-xs">
          <button
            onClick={() => setFilter("open")}
            className={`h-8 px-3 rounded-md border font-bold ${filter === "open" ? "border-neon text-neon bg-neon/5" : "border-border text-muted-foreground"}`}
          >
            פתוחים בלבד
          </button>
          <button
            onClick={() => setFilter("all")}
            className={`h-8 px-3 rounded-md border font-bold ${filter === "all" ? "border-neon text-neon bg-neon/5" : "border-border text-muted-foreground"}`}
          >
            הצג הכל
          </button>
        </div>

        {/* List */}
        {loading ? (
          <div className="grid place-content-center py-16"><Loader2 className="h-6 w-6 animate-spin text-neon" /></div>
        ) : visible.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground text-sm rounded-xl border border-dashed border-border">
            <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-emerald-500" />
            אין פערים פתוחים — כל הקליטות תקינות 🎉
          </div>
        ) : (
          <div className="space-y-2">
            {visible.map((r) => (
              <div key={r.id} className={`rounded-lg border p-3 ${r.resolved ? "border-border bg-card opacity-70" : "border-border bg-card"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className={`text-[10.5px] font-bold px-2 py-0.5 rounded border ${REASON_STYLE[r.reason]}`}>
                        {REASON_LABEL[r.reason]}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {suppliers[r.supplier_id ?? ""] ?? "ספק לא ידוע"} · {new Date(r.created_at).toLocaleDateString("he-IL")}
                      </span>
                    </div>
                    <div className="font-bold text-sm truncate">{r.product_name}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5 tabular-nums">
                      {r.expected_qty != null && <>הוזמן: <b className="text-foreground">{r.expected_qty}</b> · </>}
                      התקבל: <b className={r.actual_qty != null && r.expected_qty != null && r.actual_qty < r.expected_qty ? "text-red-400" : "text-foreground"}>{r.actual_qty ?? 0}</b>
                    </div>
                  </div>
                  <button
                    onClick={() => toggleResolved(r)}
                    className={`shrink-0 inline-flex items-center gap-1 h-9 px-3 rounded-md text-xs font-bold border ${r.resolved ? "border-emerald-500/40 text-emerald-400 bg-emerald-500/10" : "border-amber-brand/40 text-amber-brand hover:bg-amber-brand/10"}`}
                  >
                    {r.resolved ? <><CheckCircle2 className="h-3.5 w-3.5" /> טופל</> : <><AlertTriangle className="h-3.5 w-3.5" /> סמן כטופל</>}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
