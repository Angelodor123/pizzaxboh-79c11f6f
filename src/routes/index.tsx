import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { CalendarDays, ChefHat, ClipboardCheck, Truck, ShieldCheck, StickyNote } from "lucide-react";
import { useNotebookStore } from "@/lib/notebook-store";
import { useSiteText } from "@/lib/site-texts";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { WeatherWidget } from "@/components/WeatherWidget";
import { EvChargingWidget } from "@/components/EvChargingWidget";
import { DoughStatusCard } from "@/components/DoughStatusCard";
import { CurrentShiftProgressCard } from "@/components/CurrentShiftProgressCard";
import { SupplierAlertsBanner } from "@/components/SupplierAlertsBanner";
import { useBranchFeature } from "@/components/BranchGate";
import { withBranch } from "@/lib/branch-scope";
import { PersonalTasksCard } from "@/components/PersonalTasksCard";


export const Route = createFileRoute("/")({
  component: OperationalDashboard,
});

interface CalEvent {
  id: string;
  title: string;
  category: string;
  event_date: string | null;
  recurring_weekday: number | null;
  high_priority: boolean | null;
  supplier: string | null;
}

interface CalOverride {
  event_id: string;
  override_date: string;
  deleted: boolean | null;
  order_verification_status: "pending" | "ordered" | "skipped" | null;
}

const WEEKDAYS_HE = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function OperationalDashboard() {
  const { role, isSuperAdmin } = useAuth();
  const vehiclesEnabled = useBranchFeature("vehicles", true);

  const lists = useNotebookStore((s) => s.lists);
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [overrides, setOverrides] = useState<CalOverride[]>([]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const [ev, ov] = await Promise.all([
        withBranch(
          supabase
            .from("calendar_events")
            .select("id,title,category,event_date,recurring_weekday,high_priority,supplier")
            .limit(200),
        ),
        supabase
          .from("calendar_event_overrides")
          .select("event_id,override_date,deleted,order_verification_status"),
      ]);
      if (!mounted) return;
      if (ev.data) setEvents(ev.data as CalEvent[]);
      if (ov.data) setOverrides(ov.data as CalOverride[]);
    };
    void load();

    const channel = supabase
      .channel("dashboard_calendar_rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "calendar_events" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "calendar_event_overrides" }, () => void load())
      .subscribe();

    return () => {
      mounted = false;
      void supabase.removeChannel(channel);
    };
  }, []);

  // Helpers: drop instances marked as skipped or deleted via overrides.
  const isSkipped = (eventId: string, iso: string) => {
    const ov = overrides.find((o) => o.event_id === eventId && o.override_date === iso);
    if (!ov) return false;
    return ov.deleted === true || ov.order_verification_status === "skipped";
  };

  const todayEvents = useMemo(() => {
    const iso = todayIso();
    const wd = new Date(iso + "T00:00:00").getDay();
    return events.filter(
      (e) =>
        (e.event_date === iso || e.recurring_weekday === wd) && !isSkipped(e.id, iso),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events, overrides]);

  const tomorrowDeliveries = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const wd = d.getDay();
    return events.filter(
      (e) =>
        e.category === "delivery" &&
        (e.event_date === iso || e.recurring_weekday === wd) &&
        !isSkipped(e.id, iso),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events, overrides]);

  const openTasks = lists.tasks.filter((t) => !t.done).length;
  const shoppingCount = lists.shopping.filter((t) => !t.done).length;
  const ordersCount = lists.orders.filter((t) => !t.done).length;
  const shortagesCount = (lists.shortages ?? []).filter((t) => !t.done).length;

  const today = new Date();
  const dateLabel = today.toLocaleDateString("he-IL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const homeTitle = useSiteText("home.title", "ברוכים הבאים למרכז השליטה של Pizza X");
  const homeSubtitle = useSiteText(
    "home.subtitle",
    "מרכז הבקרה התפעולי של המטבח. הנה תמונת מצב יומית מהירה לכל מה שקורה היום במטבח.",
  );
  // (Weather title is computed inside WeatherWidget from the active branch.)
  const rainAlert = useSiteText(
    "home.rain_alert",
    "⚠️ צפי לגשם, אין לפתוח שולחנות וכיסאות בחוץ",
  );

  // Replace generic brand mention with neon-styled "Pizza X"
  const titleParts = homeTitle.split("Pizza X");

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="mb-6" data-tour="home-header">
        <h1 className="font-display text-2xl sm:text-4xl font-bold leading-tight tracking-tight text-foreground">
          {titleParts.length > 1 ? (
            <>
              {titleParts[0]}
              <span className="text-neon font-bold text-glow-neon">Pizza X</span>
              {titleParts.slice(1).join("Pizza X")}
            </>
          ) : (
            homeTitle
          )}
        </h1>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          {homeSubtitle} <span className="text-muted-foreground/80">• {dateLabel}</span>
        </p>
      </div>

      {/* Weather + EV grouped (related ambient widgets) */}
      <div className="mb-4">
        <WeatherWidget alertText={rainAlert} />
      </div>
      {vehiclesEnabled && (
        <div className="mb-6">
          <EvChargingWidget />
        </div>
      )}

      {/* Supplier ordering alerts — must order today */}
      <SupplierAlertsBanner />



      {/* Live operational telemetry */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6 items-stretch">
        <div className="h-full"><CurrentShiftProgressCard /></div>
        <div className="h-full"><DoughStatusCard /></div>
      </div>

      {/* Quick Stats — top row features the Shift Checklist prominently */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <StatCard label="משימות פתוחות" value={openTasks} to="/notebook" />
        <Link
          to="/tasks"
          data-tour="stat-tasks-top"
          aria-label="פתח צ'ק-ליסט משמרות"
          className="rounded-xl border-2 border-neon glow-neon bg-neon/10 p-4 min-h-24 flex flex-col items-center justify-center gap-1.5 text-center transition hover:bg-neon/15"
        >
          <ClipboardCheck className="h-6 w-6 text-neon" />
          <span className="text-[11px] font-bold leading-tight text-neon">צ'ק-ליסט משמרות</span>
        </Link>
        <StatCard label="אירועים היום" value={todayEvents.length} to="/calendar" tourId="stat-events-today" />
      </div>

      {/* Quick Access Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Today's Schedule */}
        <Link
          to="/calendar"
          aria-label="מעבר ללוח אירועים מלא"
          className="group rounded-xl border-2 border-jungle/30 hover:border-neon bg-card p-5 transition flex flex-col gap-3"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <CalendarDays className="h-5 w-5 text-neon shrink-0" />
              <h2 className="font-display text-lg font-bold truncate">📅 לוח אירועים – היום</h2>
            </div>
            <span className="text-xs text-muted-foreground shrink-0">{WEEKDAYS_HE[today.getDay()]}</span>
          </div>
          {todayEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground">אין אירועים מתוזמנים להיום.</p>
          ) : (
            <ul className="space-y-1.5">
              {todayEvents.slice(0, 4).map((e) => (
                <li
                  key={e.id}
                  className={`text-sm flex items-center justify-between gap-2 rounded-md px-2 py-1.5 ${
                    e.high_priority ? "bg-neon/10 text-neon" : "bg-background/40"
                  }`}
                >
                  <span className="truncate">{e.title}</span>
                  {e.supplier && (
                    <span className="text-[10px] text-muted-foreground shrink-0">{e.supplier}</span>
                  )}
                </li>
              ))}
              {todayEvents.length > 4 && (
                <li className="text-xs text-muted-foreground">+ {todayEvents.length - 4} נוספים</li>
              )}
            </ul>
          )}
          <span className="text-xs text-neon font-bold mt-auto group-hover:underline">
            פתח לוח מלא ←
          </span>
        </Link>

        {/* Daily Notebook */}
        <Link
          to="/notebook"
          data-tour="card-notebook"
          aria-label="מעבר לפנקס הערות ומשימות"
          className="group rounded-xl border-2 border-jungle/30 hover:border-neon bg-card p-5 transition flex flex-col gap-3"
        >
          <div className="flex items-center gap-2 min-w-0">
            <StickyNote className="h-5 w-5 text-neon shrink-0" />
            <h2 className="font-display text-lg font-bold truncate">📝 פנקס הערות ומשימות</h2>
          </div>
          <div className="grid grid-cols-2 gap-2 text-center">
            <NotebookMini label="משימות" value={openTasks} />
            <NotebookMini label="קניות" value={shoppingCount} />
            <NotebookMini label="הזמנות" value={ordersCount} />
            <NotebookMini label="חוסרים" value={shortagesCount} />
          </div>
          <span className="text-xs text-neon font-bold mt-auto group-hover:underline">
            פתח פנקס ←
          </span>
        </Link>
      </div>

      {/* Supplier reminders — tomorrow */}
      {tomorrowDeliveries.length > 0 && (
        <Link
          to="/calendar"
          aria-label={`תזכורת: מחר מגיעים ${tomorrowDeliveries.length} ספקים`}
          className="block mb-6 rounded-xl border-2 border-neon/40 hover:border-neon bg-neon/5 p-4 transition"
        >
          <div className="flex items-center gap-2 mb-2">
            <Truck className="h-5 w-5 text-neon shrink-0" />
            <h2 className="font-display text-base font-bold leading-snug">
              <bdi>🔔 תזכורת • מחר מגיעים {tomorrowDeliveries.length} ספקים</bdi>
            </h2>
          </div>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {tomorrowDeliveries.slice(0, 6).map((e) => (
              <li key={e.id} className="text-xs text-foreground/90 truncate">
                • {e.supplier || e.title}
              </li>
            ))}
          </ul>
        </Link>
      )}

      {/* Categorized shortcut sections (RBAC) */}
      {(() => {
        const effectiveRole = isSuperAdmin
          ? "super_admin"
          : role === "admin"
            ? "manager"
            : "employee";
        const canLogistics = effectiveRole === "manager" || effectiveRole === "super_admin";
        const canManagement = effectiveRole === "super_admin";

        return (
          <>
            <SectionHeader>מטבח ותפעול</SectionHeader>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              
              <ShortcutTile to="/tasks" icon={<ClipboardCheck className="h-5 w-5" />} label="צ'ק-ליסט משמרות" tourId="tile-tasks" />
              <ShortcutTile to="/prep" icon={<ChefHat className="h-5 w-5" />} label="הכנות יומיות" tourId="tile-prep" />
              <ShortcutTile to="/recipes" icon={<ChefHat className="h-5 w-5" />} label="כל המתכונים" tourId="tile-recipes" />
              <ShortcutTile to="/notebook" icon={<StickyNote className="h-5 w-5" />} label="פנקס הערות ומשימות" />
            </div>

            {canLogistics && (
              <>
                <SectionHeader>לוגיסטיקה ומלאי</SectionHeader>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  <ShortcutTile to="/invoices" icon={<ClipboardCheck className="h-5 w-5" />} label="קליטת סחורה" />
                  <ShortcutTile to="/orders" icon={<Truck className="h-5 w-5" />} label="הזמנת סחורה" />
                  <ShortcutTile to="/restock" icon={<Truck className="h-5 w-5" />} label="השלמות מהמחסן" tourId="tile-restock" />
                  <ShortcutTile to="/suppliers" icon={<Truck className="h-5 w-5" />} label="ניהול ספקים" tourId="tile-suppliers" />
                </div>
              </>
            )}

            {canManagement && (
              <>
                <SectionHeader>הנהלה</SectionHeader>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  <ShortcutTile to="/admin" icon={<ShieldCheck className="h-5 w-5" />} label="מערכת ניהול" tourId="tile-admin" />
                </div>
              </>
            )}
          </>
        );
      })()}
    </div>
  );
}

function StatCard({
  label,
  value,
  to,
  highlight,
  tourId,
}: {
  label: string;
  value: number;
  to: string;
  highlight?: boolean;
  tourId?: string;
}) {
  return (
    <Link
      to={to}
      data-tour={tourId}
      aria-label={`${label}: ${value}`}
      className={`rounded-xl border-2 p-4 min-h-24 flex flex-col justify-between text-right transition hover:border-neon ${
        highlight ? "border-neon glow-neon bg-neon/5" : "border-zinc-800 bg-zinc-900/40"
      }`}
    >
      <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-bold leading-snug">
        {label}
      </div>
      <div className="font-display text-3xl font-black text-neon tabular-nums mt-1 leading-none">
        {value}
      </div>
    </Link>
  );
}

function NotebookMini({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-jungle/5 border border-jungle/30 py-2">
      <div className="font-display text-xl font-black text-neon tabular-nums leading-none">
        {value}
      </div>
      <div className="text-[10px] text-muted-foreground mt-1">{label}</div>
    </div>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-zinc-400 text-sm font-bold mb-3 mt-6 border-b border-zinc-800/50 pb-1">
      {children}
    </h2>
  );
}

function ShortcutTile({
  to,
  icon,
  label,
  tourId,
}: {
  to: string;
  icon: React.ReactNode;
  label: string;
  tourId?: string;
}) {
  return (
    <Link
      to={to}
      data-tour={tourId}
      aria-label={label}
      className="rounded-xl border border-jungle/30 hover:border-neon hover:text-neon bg-card p-4 min-h-24 flex flex-col items-center justify-center gap-2 text-center transition"
    >
      <div className="text-neon">{icon}</div>
      <span className="text-sm font-bold leading-snug">{label}</span>
    </Link>
  );
}
