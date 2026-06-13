import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Pizza, Wrench, AlertTriangle, Send, UserPlus, ListChecks, ChefHat, PackageCheck, Trophy, CalendarDays, Projector, ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { NotificationTestCard } from "@/components/admin/NotificationTestCard";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface Metrics {
  doughShop: number | null;
  doughWarehouse: number | null;
  doughThreshold: number;
  openTickets: number;
  activeShortages: number;
  prepDone: number;
  prepTotal: number;
  tasksDone: number;
  tasksTotal: number;
  todaySuppliers: string[];
}

const EMPTY: Metrics = {
  doughShop: null,
  doughWarehouse: null,
  doughThreshold: 15,
  openTickets: 0,
  activeShortages: 0,
  prepDone: 0,
  prepTotal: 0,
  tasksDone: 0,
  tasksTotal: 0,
  todaySuppliers: [],
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

  // Latest dough trays per location (shop / warehouse)
  const { data: dough } = await supabase
    .from("dough_updates_log")
    .select("trays_count, location, created_at")
    .order("created_at", { ascending: false })
    .limit(50);
  const rows = (dough ?? []) as Array<{ trays_count: number; location: string }>;
  const latestShop = rows.find((r) => r.location === "shop");
  const latestWh = rows.find((r) => r.location === "warehouse");
  out.doughShop = latestShop ? Number(latestShop.trays_count) : null;
  out.doughWarehouse = latestWh ? Number(latestWh.trays_count) : null;

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

  // Today's received goods
  const { data: todayInvoices } = await supabase
    .from("invoices")
    .select("supplier_id, suppliers:supplier_id(name)")
    .eq("document_date", today)
    .eq("is_archived", false);
  const names = Array.from(
    new Set(
      (todayInvoices ?? [])
        .map((r: any) => r.suppliers?.name)
        .filter((n: any): n is string => !!n && typeof n === "string")
    )
  );
  out.todaySuppliers = names;

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


export function OverviewPanel({ onGoToUsers }: { onGoToUsers: () => void }) {
  const [m, setM] = useState<Metrics>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [sportsEvents, setSportsEvents] = useState<Array<{ id: string; title: string; event_date: string; start_time: string | null; notes: string | null; projector_broadcast: boolean | null }>>([]);



  const loadSports = async () => {
    const today = new Date().toISOString().slice(0, 10);
    const { data } = await supabase
      .from("calendar_events")
      .select("id, title, event_date, start_time, notes, projector_broadcast")
      .eq("event_type", "sports_match")
      .gte("event_date", today)
      .order("event_date", { ascending: true })
      .order("start_time", { ascending: true })
      .limit(3);
    setSportsEvents((data ?? []) as never);
  };

  useEffect(() => {
    let alive = true;
    const run = async () => {
      try {
        const data = await loadMetrics();
        if (alive) setM(data);
        await loadSports();
      } finally {
        if (alive) setLoading(false);
      }
    };
    void run();
    const t = setInterval(run, 30000);

    // Realtime: refresh shortage KPI the moment notebook_items changes.
    // Guarantees the "חוסרים פעילים" card always mirrors the DB, never a stale
    // 30-second snapshot.
    const channel = supabase
      .channel("overview-shortages")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notebook_items" },
        () => { void run(); },
      )
      .subscribe();

    return () => {
      alive = false;
      clearInterval(t);
      void supabase.removeChannel(channel);
    };
  }, []);


  const doughTotal =
    m.doughShop == null && m.doughWarehouse == null
      ? null
      : (m.doughShop ?? 0) + (m.doughWarehouse ?? 0);
  const doughLow = doughTotal != null && doughTotal < m.doughThreshold;
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

      {/* Section A — מצב עכשווי */}
      <section>
        <div className="text-[10px] uppercase tracking-[0.3em] text-neon font-bold mb-2">
          מצב עכשווי
        </div>
        <div className="rounded-2xl border border-border bg-card/60 backdrop-blur p-5">
          <div className="grid grid-cols-3 divide-x divide-x-reverse divide-border">
            <StatColumn
              icon={<Pizza className="h-5 w-5" />}
              label="בצק"
              value={loading ? "…" : doughTotal ?? "—"}
              alert={doughLow}
              sub={
                loading
                  ? `סף התראה: ${m.doughThreshold}`
                  : doughTotal != null
                    ? `בפיצה: ${m.doughShop ?? 0} · במחסן: ${m.doughWarehouse ?? 0}`
                    : `סף התראה: ${m.doughThreshold}`
              }
            />
            <StatColumn
              icon={<Wrench className="h-5 w-5" />}
              label="קריאות שירות"
              value={loading ? "…" : m.openTickets}
              alert={m.openTickets > 0}
              href="/service-calls"
            />
            <StatColumn
              icon={<AlertTriangle className="h-5 w-5" />}
              label="חוסרים"
              value={loading ? "…" : m.activeShortages}
              alert={m.activeShortages > 0}
              href="/notebook"
            />
          </div>
        </div>

        {/* Today's Deliveries — kept inline under the live status row */}
        {(() => {
          const hasDeliveries = m.todaySuppliers.length > 0;
          return (
            <div
              className={`mt-3 rounded-xl border p-4 backdrop-blur transition ${
                hasDeliveries
                  ? "border-neon/60 bg-neon/5 shadow-[0_0_28px_-10px_hsl(var(--neon))]"
                  : "border-border bg-card/60"
              }`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`p-2 rounded-md shrink-0 ${
                    hasDeliveries ? "bg-neon/15 text-neon" : "bg-muted text-muted-foreground"
                  }`}
                >
                  <PackageCheck className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    סחורה שהתקבלה היום
                  </div>
                  {loading ? (
                    <div className="mt-2 text-sm text-muted-foreground">…</div>
                  ) : hasDeliveries ? (
                    <div className="mt-2 text-base font-bold text-foreground leading-relaxed">
                      התקבלה סחורה מ:{" "}
                      <span className="text-neon">{m.todaySuppliers.join(", ")}</span>
                    </div>
                  ) : (
                    <div className="mt-2 text-sm text-muted-foreground">
                      טרם נקלטה סחורה היום
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })()}
      </section>

      {/* Section B — התקדמות היום */}
      <section>
        <div className="text-[10px] uppercase tracking-[0.3em] text-neon font-bold mb-2">
          התקדמות היום
        </div>
        <div className="rounded-2xl border border-border bg-card/60 p-5">
          <div className="grid grid-cols-2 gap-4">
            <Link to="/prep" className="flex justify-center">
              <CircularProgress value={prepPct} label="הכנות יומיות" done={m.prepDone} total={m.prepTotal} />
            </Link>
            <Link to="/tasks" className="flex justify-center">
              <CircularProgress value={tasksPct} label="צ'קליסטים" done={m.tasksDone} total={m.tasksTotal} />
            </Link>
          </div>
        </div>
      </section>

      {/* Sports events — between Section B and Section C */}
      <div className="rounded-xl border border-border bg-card/60 p-5 backdrop-blur">
        <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-md bg-neon/10 text-neon">
              <Trophy className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                אירועים קרובים
              </div>
              <div className="text-[11px] text-muted-foreground">משחקי כדורגל גדולים שמשודרים בפיצה</div>
            </div>
          </div>
        </div>
        {sportsEvents.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-4">
            אין משחקים מתוכננים. לחץ על "סנכרן משחקים" כדי לטעון את הקרובים.
          </div>
        ) : (
          <ul className="space-y-2">
            {sportsEvents.map((ev) => (
              <li key={ev.id} className="flex items-start gap-3 rounded-lg border border-border bg-background/40 p-3">
                <div className="p-1.5 rounded-md bg-neon/10 text-neon shrink-0">
                  <CalendarDays className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-foreground truncate flex items-center gap-1.5">
                    <span className="truncate">{ev.title}</span>
                    {ev.projector_broadcast && (
                      <span
                        title="הקרנה במקרן"
                        className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-neon/15 text-neon border border-neon/40 text-[10px] font-bold"
                      >
                        <Projector className="h-3 w-3" />
                        מקרן
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    {new Date(ev.event_date).toLocaleDateString("he-IL", { weekday: "short", day: "2-digit", month: "2-digit" })}
                    {ev.start_time ? ` · ${ev.start_time.slice(0, 5)}` : ""}
                  </div>
                  {ev.notes && (
                    <div className="text-[11px] text-muted-foreground mt-1 truncate">{ev.notes}</div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Section C — פעולות מהירות + קיצורי דרך */}
      <section>
        <div className="text-[10px] uppercase tracking-[0.3em] text-neon font-bold mb-2">
          פעולות מהירות וקיצורי דרך
        </div>
        <div className="rounded-2xl border border-border bg-card/60 p-5 space-y-4">
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

          <div className="h-px bg-border/60" />

          <div className="grid grid-cols-3 gap-2">
            <Link to="/tasks" className="rounded-lg border border-border p-3 text-xs sm:text-sm font-bold text-foreground hover:border-neon/60 hover:text-neon transition inline-flex items-center justify-center gap-1.5 text-center">
              <ListChecks className="h-4 w-4 shrink-0" />
              <span className="truncate">צ'קליסטים</span>
            </Link>
            <Link to="/prep" className="rounded-lg border border-border p-3 text-xs sm:text-sm font-bold text-foreground hover:border-neon/60 hover:text-neon transition inline-flex items-center justify-center gap-1.5 text-center">
              <ChefHat className="h-4 w-4 shrink-0" />
              <span className="truncate">הכנות יומיות</span>
            </Link>
            <Link to="/notebook" className="rounded-lg border border-border p-3 text-xs sm:text-sm font-bold text-foreground hover:border-neon/60 hover:text-neon transition inline-flex items-center justify-center gap-1.5 text-center">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span className="truncate">פנקס וחוסרים</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Notification settings & testing — collapsed by default */}
      <Collapsible>
        <div className="rounded-xl border border-border bg-card/60">
          <CollapsibleTrigger className="group w-full flex items-center justify-between gap-2 px-4 py-3 text-right">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-md bg-neon/10 text-neon">
                <Send className="h-4 w-4" />
              </div>
              <span className="text-sm font-bold text-foreground">בדיקת התראות</span>
            </div>
            <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="px-4 pb-4">
              <NotificationTestCard />
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>
    </div>
  );
}

function StatColumn({
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
  const content = (
    <div className="flex flex-col items-center text-center px-3 py-1">
      <div
        className={`p-2 rounded-md mb-2 ${
          alert ? "bg-destructive/15 text-destructive" : "bg-neon/10 text-neon"
        }`}
      >
        {icon}
      </div>
      <div
        className={`text-3xl sm:text-4xl font-black tabular-nums leading-none ${
          alert ? "text-destructive drop-shadow-[0_0_10px_hsl(var(--destructive))]" : "text-foreground"
        }`}
      >
        {value}
      </div>
      <div className="mt-2 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
        {label}
      </div>
      {sub && <div className="mt-1 text-[10px] text-muted-foreground/80 line-clamp-2">{sub}</div>}
    </div>
  );
  if (href) {
    return (
      <Link to={href} className="block hover:opacity-90 transition">
        {content}
      </Link>
    );
  }
  return content;
}
