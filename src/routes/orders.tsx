import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useCallback } from "react";
import { Truck, ChevronRight, Camera, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { GridSkeleton } from "@/components/ui/skeletons";
import { useAuth } from "@/lib/auth";
import { resolveSupplierLogo } from "@/lib/supplier-logos";
import { OrderModal } from "@/components/OrderModal";
import { SmartReceivingModal } from "@/components/SmartReceivingModal";
import { getActiveBranchIdSync, subscribeBranch } from "@/lib/current-branch";
import { PullToRefresh } from "@/components/PullToRefresh";
import { toastError } from "@/lib/error-messages";



export const Route = createFileRoute("/orders")({
  component: OrdersPage,
});

interface Supplier {
  id: string;
  name: string;
  category: string;
  contact: string | null;
  logo_url: string | null;
  active: boolean;
  is_archived: boolean;
}

function OrdersPage() {
  const { role, loading: authLoading, isSuperAdmin } = useAuth();
  const [list, setList] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Supplier | null>(null);
  const [receiving, setReceiving] = useState<{ orderId: string | null } | null>(null);
  const [monthCount, setMonthCount] = useState(0);
  const [branchId, setBranchId] = useState<string | null>(() => getActiveBranchIdSync());

  useEffect(() => subscribeBranch((id) => setBranchId(id)), []);

  const load = useCallback(async (signal?: { aborted: boolean }) => {
    setLoading(true);
    try {
      let supplierQuery = supabase
        .from("suppliers")
        .select("id,name,category,contact,logo_url,active,is_archived")
        .eq("is_archived", false)
        .eq("active", true)
        .order("name");
      if (branchId) supplierQuery = supplierQuery.eq("branch_id", branchId);
      const { data, error } = await supplierQuery;
      if (error) throw error;
      if (signal?.aborted) return;
      setList((data as Supplier[]) ?? []);

      const firstOfMonth = new Date();
      firstOfMonth.setDate(1);
      firstOfMonth.setHours(0, 0, 0, 0);
      let historyQuery = supabase
        .from("supplier_orders_history")
        .select("id", { count: "exact", head: true })
        .gte("created_at", firstOfMonth.toISOString());
      if (branchId) historyQuery = historyQuery.eq("branch_id", branchId);
      const { count, error: histErr } = await historyQuery;
      if (histErr) throw histErr;
      if (signal?.aborted) return;
      setMonthCount(count ?? 0);
    } catch (err) {
      if (!signal?.aborted) toastError(err, "טעינת רשימת הספקים נכשלה.");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [branchId]);

  useEffect(() => {
    if (role !== "admin") return;
    const signal = { aborted: false };
    void load(signal);
    return () => { signal.aborted = true; };
  }, [role, isSuperAdmin, branchId, load]);

  const grid = useMemo(() => list, [list]);

  if (authLoading) return <div className="p-8 text-center text-muted-foreground">טוען…</div>;
  if (role !== "admin") {
    return (
      <div className="max-w-md mx-auto p-8 text-center" dir="rtl">
        <p className="text-muted-foreground">אין הרשאה. מודול הזמנות זמין למנהלים בלבד.</p>
        <Link to="/" className="text-neon font-bold mt-3 inline-block">חזרה לדף הבית</Link>
      </div>
    );
  }

  return (
    <PullToRefresh onRefresh={() => load()}>
    <div className="max-w-6xl mx-auto px-4 py-6" dir="rtl">
      <div className="mb-6 text-center">
        <div className="text-[10px] uppercase tracking-[0.3em] text-neon font-bold">Supplier Ordering</div>
        <h1 className="font-display text-3xl sm:text-4xl font-bold mt-1 leading-tight">
          📦 הזמנת <span className="text-neon text-glow-neon">סחורה</span>
        </h1>
        <p className="hidden sm:block text-muted-foreground mt-2 text-sm">
          לחץ על לוגו של ספק כדי להכין הזמנה ולשלוח דרך וואטסאפ.
        </p>
        <div className="mt-3 flex items-center justify-center gap-2 flex-wrap">
          <button
            onClick={() => setReceiving({ orderId: null })}
            className="inline-flex items-center gap-2 h-11 px-5 rounded-md font-bold text-white active:scale-95 transition"
            style={{ background: "linear-gradient(135deg, #ff2db4, #ff5ec0)", boxShadow: "0 0 22px rgba(255,45,180,0.45)" }}
          >
            <Camera className="h-4 w-4" /> קבלת סחורה
          </button>
          <div className="inline-flex items-center gap-2 text-xs text-muted-foreground border border-border rounded-full px-3 py-1">
            <span>הזמנות החודש:</span>
            <span className="text-neon font-bold tabular-nums">{monthCount}</span>
          </div>
        </div>
      </div>

      {loading ? (
        <GridSkeleton items={8} />
      ) : grid.length === 0 ? (
        <div className="text-center text-muted-foreground py-12 rounded-2xl border border-border bg-card/60">
          אין ספקים פעילים. הוסף ספקים במסך <Link to="/suppliers" className="text-neon font-bold">ניהול ספקים</Link>.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
          {grid.map((s) => {
            const logo = resolveSupplierLogo(s.name, s.logo_url);
            return (
              <button
                key={s.id}
                onClick={() => setSelected(s)}
                className="group rounded-xl border border-border bg-card overflow-hidden text-center transition hover:border-neon hover:shadow-[0_0_0_3px_color-mix(in_oklab,var(--neon)_30%,transparent)] hover:scale-[1.03] active:scale-95"
              >
                <div className="h-32 w-full flex items-center justify-center p-4 rounded-t-lg bg-zinc-800/50">
                  {logo ? (
                    <img
                      src={logo}
                      alt={s.name}
                      className="object-contain max-h-full max-w-full transition group-hover:scale-105"
                      loading="lazy"
                    />
                  ) : (
                    <Truck className="h-12 w-12 text-muted-foreground" />
                  )}
                </div>
                <div className="p-3">
                  <div className="font-bold text-sm leading-tight truncate">{s.name}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5 truncate">{s.category}</div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      

      <div className="mt-6 text-center">
        <Link to="/suppliers" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-neon">
          <ChevronRight className="h-3 w-3" />
          ניהול ספקים, לוגואים וימי חלוקה
        </Link>
      </div>


      {selected && (
        <OrderModal
          supplier={selected}
          onClose={() => setSelected(null)}
          onReceive={(orderId) => setReceiving({ orderId })}
        />
      )}
      {receiving && (
        <SmartReceivingModal
          suppliers={list.map((s) => ({ id: s.id, name: s.name }))}
          linkedOrderId={receiving.orderId}
          onClose={() => setReceiving(null)}
          onSaved={() => setReceiving(null)}
        />
      )}
    </div>
    </PullToRefresh>
  );
}
