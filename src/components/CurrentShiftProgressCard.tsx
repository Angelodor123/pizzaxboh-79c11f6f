import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ClipboardCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveBranch } from "@/components/BranchGate";

// Determines current active shift purely by Asia/Jerusalem local hour:
//   - 05:00–15:59 → morning
//   - 16:00–22:59 → evening
//   - else        → closing
function currentShiftFilter(now: Date): {
  label: string;
  matcher: (name: string) => boolean;
} {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      hour12: false,
      timeZone: "Asia/Jerusalem",
    }).format(now),
  );
  if (hour >= 5 && hour < 16) {
    return { label: "משמרת בוקר", matcher: (n) => /בוקר/.test(n) };
  }
  if (hour >= 16 && hour < 23) {
    return { label: "משמרת ערב", matcher: (n) => /ערב/.test(n) };
  }
  return {
    label: "סגירת משמרת",
    matcher: (n) => /סגירה|יציאה/.test(n),
  };
}

export function CurrentShiftProgressCard() {
  const branchId = useActiveBranch();
  const [pct, setPct] = useState(0);
  const [done, setDone] = useState(0);
  const [total, setTotal] = useState(0);
  const [shiftName, setShiftName] = useState("");

  useEffect(() => {
    if (!branchId) return;
    let abort = false;
    const compute = async () => {
      const filter = currentShiftFilter(new Date());
      const [{ data: shifts }, { data: groups }, { data: tasks }, { data: today }] =
        await Promise.all([
          supabase
            .from("shifts")
            .select("id,name")
            .eq("branch_id", branchId)
            .eq("active", true),
          supabase
            .from("task_groups")
            .select("id,shift_id")
            .eq("branch_id", branchId)
            .eq("active", true),
          supabase
            .from("tasks")
            .select("id,group_id")
            .eq("branch_id", branchId)
            .eq("active", true),
          supabase.rpc("operational_today"),
        ]);
      if (abort) return;
      const matchedShift =
        ((shifts ?? []) as Array<{ id: string; name: string }>).find((s) =>
          filter.matcher(s.name),
        ) ?? ((shifts ?? [])[0] as { id: string; name: string } | undefined);
      if (!matchedShift) {
        setTotal(0);
        setDone(0);
        setPct(0);
        setShiftName(filter.label);
        return;
      }
      const shiftGroupIds = new Set(
        ((groups ?? []) as Array<{ id: string; shift_id: string }>)
          .filter((g) => g.shift_id === matchedShift.id)
          .map((g) => g.id),
      );
      const shiftTaskIds = ((tasks ?? []) as Array<{ id: string; group_id: string }>)
        .filter((t) => shiftGroupIds.has(t.group_id))
        .map((t) => t.id);
      const totalCount = shiftTaskIds.length;
      let doneCount = 0;
      if (totalCount > 0) {
        const { data: logs } = await supabase
          .from("daily_task_logs")
          .select("task_id,completed")
          .eq("branch_id", branchId)
          .eq("log_date", today as string)
          .in("task_id", shiftTaskIds);
        doneCount = ((logs ?? []) as Array<{ completed: boolean }>).filter(
          (l) => l.completed,
        ).length;
      }
      setShiftName(matchedShift.name);
      setTotal(totalCount);
      setDone(doneCount);
      setPct(totalCount === 0 ? 0 : Math.round((doneCount / totalCount) * 100));
    };
    void compute();
    const interval = window.setInterval(compute, 30_000);
    return () => {
      abort = true;
      window.clearInterval(interval);
    };
  }, [branchId]);

  return (
    <Link
      to="/tasks"
      className="rounded-xl border-2 border-neon/40 hover:border-neon bg-card p-4 transition flex flex-col gap-2"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-neon">
          <ClipboardCheck className="h-4 w-4" />
          <span className="text-[10px] uppercase tracking-[0.2em] font-bold">
            סטטוס משמרת נוכחית
          </span>
        </div>
        <span className="text-[10px] text-foreground/70 truncate max-w-[55%] text-left">
          {shiftName}
        </span>
      </div>
      <div className="flex items-end gap-2">
        <div className="font-display text-3xl font-black text-neon tabular-nums leading-none">
          {pct}%
        </div>
        <div className="text-xs text-foreground/70 pb-1">
          {done}/{total} משימות
        </div>
      </div>
      <div className="h-2 rounded-full bg-background/60 border border-border overflow-hidden">
        <div
          className="h-full bg-neon transition-all duration-500"
          style={{ width: `${pct}%`, boxShadow: "0 0 10px hsl(var(--neon))" }}
        />
      </div>
    </Link>
  );
}
