import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Pizza, Wrench, AlertTriangle, Send, UserPlus, ListChecks, ChefHat, PackageCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Metrics {
  doughTrays: number | null;
  doughThreshold: number;
  openTickets: number;
  activeShortages: number;
  prepDone: number;
  prepTotal: number;
  tasksDone: number;
  tasksTotal: number;
}

const EMPTY: Metrics = {
  doughTrays: null,
  doughThreshold: 15,
  openTickets: 0,
  activeShortages: 0,
  prepDone: 0,
  prepTotal: 0,
  tasksDone: 0,
  tasksTotal: 0,
};

async function loadMetrics(): Promise<Metrics> {
  const out: Metrics = { ...EMPTY };

  // Threshold
  const { data: thr } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "dough_alert_threshold")
    .maybeSingle();
  out.doughThreshold = Number((thr?.value as any)?.value ?? 15);

  // Latest dough trays
  const { data: dough } = await supabase
    .from("dough_updates_log")
    .select("trays_count, created_at")
    .order("created_at", { ascending: false })
    .limit(1);
  out.doughTrays = dough?.[0]?.trays_count ?? null;

  // Open maintenance tickets (unread by admin)
  const { count: ticketCount } = await supabase
    .from("maintenance_tickets")
    .select("id", { count: "exact", head: true })
    .eq("is_read_by_admin", false)
    .eq("status", "open");
  out.openTickets = ticketCount ?? 0;

  // Active shortages (from notebook)
  const { count: shortageCount } = await supabase
    .from("notebook_items")
    .select("id", { count: "exact", head: true })
    .eq("list_key", "shortages")
    .eq("done", false)
    .is("archived_at", null);
  out.activeShortages = shortageCount ?? 0;

  // Today's date
  const { data: todayData } = await supabase.rpc("operational_today");
  const today = String(todayData);

  // Prep progress
  const { data: prepItems } = await supabase
    .from("prep_items")
    .select("id")
    .eq("active", true);
  out.prepTotal = prepItems?.length ?? 0;
  if (out.prepTotal > 0) {
    const { count: doneCount } = await supabase
      .from("prep_log")
      .select("id", { count: "exact", head: true })
      .eq("log_date", today)
      .eq("completed", true);
    out.prepDone = doneCount ?? 0;
  }

  // Tasks progress
  const { data: tasks } = await supabase
    .from("tasks")
    .select("id")
    .eq("active", true);
  out.tasksTotal = tasks?.length ?? 0;
  if (out.tasksTotal > 0) {
    const { count: tDone } = await supabase
      .from("daily_task_logs")
      .select("id", { count: "exact", head: true })
      .eq("log_date", today)
      .eq("completed", true);
    out.tasksDone = tDone ?? 0;
  }

  return out;
}

function CircularProgress({ value, label, total, done }: { value: number; label: string; total: number; done: number }) {
  const r = 38;
  const c = 2 * Math.PI * r;
  const offset = c - (Math.min(100, Math.max(0, value)) / 100) * c;
  return (
    <div className="flex flex-col items-center">
      <div className="relative h-24 w-24">
        <svg className="h-full w-full -rotate-90" viewBox="0 0 88 88">
          <circle cx="44" cy="44" r={r} fill="none" stroke="hsl(var(--border))" strokeWidth="8" />
          <circle
            cx="44"
            cy="44"
            r={r}
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth="8"
            strokeDasharray={c}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="transition-all duration-500"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-bold text-foreground tabular-nums">{value}%</span>
          <span className="text-[10px] text-muted-foreground tabular-nums">
            {done}/{total}
          </span>
        </div>
      </div>
      <div className="mt-2 text-xs font-bold text-foreground text-center">{label}</div>
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  alert,
  href,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  alert?: boolean;
  href?: string;
  sub?: string;
}) {
  const inner = (
    <div
      className={`rounded-xl border p-4 bg-card/60 backdrop-blur transition h-full ${
        alert
          ? "border-destructive/60 shadow-[0_0_24px_-8px_hsl(var(--destructive))]"
          : "border-border hover:border-neon/60"
      }`}
    >
      <div className="flex items-center justify-between">
        <div className={`p-2 rounded-md ${alert ? "bg-destructive/15 text-destructive" : "bg-neon/10 text-neon"}`}>
          {icon}
        </div>
        <div className={`text-3xl font-bold tabular-nums ${alert ? "text-destructive" : "text-foreground"}`}>
          {value}
        </div>
      </div>
      <div className="mt-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">{label}</div>
      {sub && <div className="mt-1 text-[11px] text-muted-foreground">{sub}</div>}
    </div>
  );
  if (href) {
    return (
      <Link to={href} className="block">
        {inner}
      </Link>
    );
  }
  return inner;
}

export function OverviewPanel({ onGoToUsers }: { onGoToUsers: () => void }) {
  const [m, setM] = useState<Metrics>(EMPTY);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    const run = async () => {
      try {
        const data = await loadMetrics();
        if (alive) setM(data);
      } finally {
        if (alive) setLoading(false);
      }
    };
    void run();
    const t = setInterval(run, 30000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  const doughLow = m.doughTrays != null && m.doughTrays < m.doughThreshold;
  const prepPct = m.prepTotal ? Math.round((m.prepDone / m.prepTotal) * 100) : 0;
  const tasksPct = m.tasksTotal ? Math.round((m.tasksDone / m.tasksTotal) * 100) : 0;

  return (
    <div className="space-y-6" dir="rtl">
      <div>
        <h2 className="font-display text-xl font-bold">סקירה כללית</h2>
        <p className="text-sm text-muted-foreground mt-1">
          מטריקות תפעוליות בזמן אמת. מתעדכן כל 30 שניות.
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <KpiCard
          icon={<Pizza className="h-5 w-5" />}
          label="מגשי בצק כעת"
          value={loading ? "…" : m.doughTrays ?? "—"}
          sub={`סף התראה: ${m.doughThreshold}`}
          alert={doughLow}
        />
        <KpiCard
          icon={<Wrench className="h-5 w-5" />}
          label="קריאות שירות פתוחות"
          value={loading ? "…" : m.openTickets}
          href="/admin/maintenance"
          alert={m.openTickets > 0}
        />
        <KpiCard
          icon={<AlertTriangle className="h-5 w-5" />}
          label="חוסרים פעילים"
          value={loading ? "…" : m.activeShortages}
          href="/notebook"
          alert={m.activeShortages > 0}
        />
      </div>

      {/* Progress visuals */}
      <div className="rounded-xl border border-border bg-card/60 p-5">
        <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4">
          התקדמות יומית
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Link to="/prep" className="flex justify-center">
            <CircularProgress value={prepPct} label="הכנות יומיות" done={m.prepDone} total={m.prepTotal} />
          </Link>
          <Link to="/tasks" className="flex justify-center">
            <CircularProgress value={tasksPct} label="צ'קליסטים" done={m.tasksDone} total={m.tasksTotal} />
          </Link>
        </div>
      </div>

      {/* Quick actions */}
      <div className="rounded-xl border border-border bg-card/60 p-5">
        <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">
          פעולות מהירות
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Link
            to="/admin/alerts"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-neon text-primary-foreground font-bold px-4 py-3 glow-neon hover:brightness-110 transition"
          >
            <Send className="h-4 w-4" />
            שלח התראת צוות
          </Link>
          <button
            type="button"
            onClick={onGoToUsers}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-neon/60 text-neon font-bold px-4 py-3 hover:bg-neon/10 transition"
          >
            <UserPlus className="h-4 w-4" />
            הוסף עובד
          </button>
        </div>
      </div>

      {/* Shortcut grid to operational pages */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <Link to="/tasks" className="rounded-lg border border-border p-3 text-sm font-bold text-foreground hover:border-neon/60 hover:text-neon transition inline-flex items-center gap-2">
          <ListChecks className="h-4 w-4" /> צ'קליסטים
        </Link>
        <Link to="/prep" className="rounded-lg border border-border p-3 text-sm font-bold text-foreground hover:border-neon/60 hover:text-neon transition inline-flex items-center gap-2">
          <ChefHat className="h-4 w-4" /> הכנות יומיות
        </Link>
        <Link to="/notebook" className="rounded-lg border border-border p-3 text-sm font-bold text-foreground hover:border-neon/60 hover:text-neon transition inline-flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" /> פנקס וחוסרים
        </Link>
      </div>
    </div>
  );
}
