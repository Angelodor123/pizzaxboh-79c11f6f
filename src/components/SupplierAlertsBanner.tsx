import { useEffect, useState } from "react";
import { AlertTriangle, Clock, Truck } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useActiveBranch } from "@/components/BranchGate";

interface Row {
  id: string;
  name: string;
  order_days: number[] | null;
  order_cutoff_time: string | null;
  delivery_days: number[] | null;
}

/**
 * Dashboard banner: when today is a supplier's `order_day`,
 * surface an alert with the cutoff time. Used only for active, non-archived suppliers.
 */
export function SupplierAlertsBanner() {
  const [rows, setRows] = useState<Row[]>([]);
  const today = new Date().getDay();
  const activeBranchId = useActiveBranch();

  useEffect(() => {
    if (!activeBranchId) {
      setRows([]);
      return;
    }
    let mounted = true;
    const load = async () => {
      const { data } = await supabase
        .from("suppliers")
        .select("id,name,order_days,order_cutoff_time,delivery_days")
        .eq("active", true)
        .eq("is_archived", false)
        .eq("branch_id", activeBranchId);
      if (mounted && data) setRows(data as Row[]);
    };
    load();
    const ch = supabase
      .channel(`supplier_alerts_rt_${activeBranchId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "suppliers", filter: `branch_id=eq.${activeBranchId}` },
        () => load(),
      )
      .subscribe();
    return () => {
      mounted = false;
      supabase.removeChannel(ch);
    };
  }, [activeBranchId]);

  const dueToday = rows.filter((r) => (r.order_days ?? []).includes(today));
  if (dueToday.length === 0) return null;

  return (
    <Link
      to="/suppliers"
      aria-label={`חובת הזמנה היום מ-${dueToday.length} ספקים`}
      className="block mb-4 rounded-xl border-2 border-destructive/60 bg-destructive/10 p-4 transition hover:border-destructive"
    >
      <div className="flex items-center gap-2 mb-2">
        <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
        <h2 className="font-display text-base font-bold leading-snug">
          ⚠️ חובת הזמנת סחורה היום ({dueToday.length})
        </h2>
      </div>
      <ul className="space-y-1.5">
        {dueToday.map((s) => (
          <li
            key={s.id}
            className="text-sm flex items-center justify-between gap-2 rounded-md bg-background/40 px-2.5 py-1.5"
          >
            <span className="flex items-center gap-1.5 min-w-0">
              <Truck className="h-3.5 w-3.5 text-destructive shrink-0" />
              <span className="font-bold truncate">{s.name}</span>
            </span>
            {s.order_cutoff_time && (
              <span className="flex items-center gap-1 text-xs tabular-nums text-destructive font-bold shrink-0">
                <Clock className="h-3 w-3" />
                עד {s.order_cutoff_time.slice(0, 5)}
              </span>
            )}
          </li>
        ))}
      </ul>
    </Link>
  );
}
