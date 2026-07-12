import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ClipboardCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveBranch } from "@/components/BranchGate";

// Determines current active shift by Asia/Jerusalem local time:
//   - Morning: 09:00–16:59
//   - Evening: 17:00–05:59
//   - Closing: 06:00–08:59
export function currentShiftFilter(now: Date): {
  label: string;
  matcher: (name: string) => boolean;
} {
  const parts = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    weekday: "short",
    hour12: false,
    timeZone: "Asia/Jerusalem",
  }).formatToParts(now);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");

  const morning = { label: "משמרת בוקר", matcher: (n: string) => /בוקר/.test(n) };
  const evening = { label: "משמרת ערב", matcher: (n: string) => /ערב|לילה/.test(n) };
  const closing = { label: "סגירת משמרת", matcher: (n: string) => /סגירה|יציאה/.test(n) };

  if (hour >= 9 && hour < 17) return morning;
  if (hour >= 17) return evening;
  const cutoff = 6; // closing shift runs until 06:00 every day
  if (hour < cutoff) return evening;
  return closing;
}

export interface ShiftProgress {
  done: number;
  total: number;
  pct: number;
  shiftName: string;
}

export async function computeShiftProgress(branchId: string): Promise<ShiftProgress> {
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
        .select("id,group_id,shift_id,recurrence_type,recurrence_day")
        .eq("branch_id", branchId)
        .eq("active", true),
      supabase.rpc("operational_today"),
    ]);
  const matchedShift =
    ((shifts ?? []) as Array<{ id: string; name: string }>).find((s) =>
      filter.matcher(s.name),
    ) ?? ((shifts ?? [])[0] as { id: string; name: string } | undefined);
  if (!matchedShift) {
    return { done: 0, total: 0, pct: 0, shiftName: filter.label };
  }
  const shiftGroupIds = new Set(
    ((groups ?? []) as Array<{ id: string; shift_id: string }>)
      .filter((g) => g.shift_id === matchedShift.id)
      .map((g) => g.id),
  );
  const todayDate = new Date();
  const dow = todayDate.getDay();
  const dom = todayDate.getDate();
  const shiftTaskIds = ((tasks ?? []) as Array<{ id: string; group_id: string | null; shift_id: string | null; recurrence_type: string | null; recurrence_day: number | null }>)
    .filter((t) => (t.group_id && shiftGroupIds.has(t.group_id)) || t.shift_id === matchedShift.id)
    .filter((t) => {
      const rt = t.recurrence_type ?? "daily";
      if (rt === "daily") return true;
      if (rt === "weekly") return (t.recurrence_day ?? dow) === dow;
      if (rt === "monthly") return (t.recurrence_day ?? 1) === dom;
      return false;
    })
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
  return {
    done: doneCount,
    total: totalCount,
    pct: totalCount === 0 ? 0 : Math.round((doneCount / totalCount) * 100),
    shiftName: matchedShift.name,
  };
}

interface Props {
  done?: number;
  total?: number;
  pct?: number;
  shiftName?: string;
}

export function CurrentShiftProgressCard(props: Props = {}) {
  const controlled =
    props.done !== undefined &&
    props.total !== undefined &&
    props.pct !== undefined &&
    props.shiftName !== undefined;

  const branchId = useActiveBranch();
  const [pct, setPct] = useState(0);
  const [done, setDone] = useState(0);
  const [total, setTotal] = useState(0);
  const [shiftName, setShiftName] = useState("");

  useEffect(() => {
    if (controlled) return;
    if (!branchId) return;
    let abort = false;
    const compute = async () => {
      const res = await computeShiftProgress(branchId);
      if (abort) return;
      setDone(res.done);
      setTotal(res.total);
      setPct(res.pct);
      setShiftName(res.shiftName);
    };
    void compute();
    const interval = window.setInterval(compute, 30_000);
    return () => {
      abort = true;
      window.clearInterval(interval);
    };
  }, [branchId, controlled]);

  const vDone = controlled ? props.done! : done;
  const vTotal = controlled ? props.total! : total;
  const vPct = controlled ? props.pct! : pct;
  const vShiftName = controlled ? props.shiftName! : shiftName;

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
          {vShiftName}
        </span>
      </div>
      <div className="flex items-end gap-2">
        <div className="font-display text-3xl font-black text-neon tabular-nums leading-none">
          {vPct}%
        </div>
        <div className="text-xs text-foreground/70 pb-1">
          {vDone}/{vTotal} משימות
        </div>
      </div>
      <div className="h-2 rounded-full bg-background/60 border border-border overflow-hidden">
        <div
          className="h-full bg-neon transition-all duration-500"
          style={{ width: `${vPct}%`, boxShadow: "0 0 10px hsl(var(--neon))" }}
        />
      </div>
    </Link>
  );
}
