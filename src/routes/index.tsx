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

const WEEKDAYS_HE = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function OperationalDashboard() {
  const { role } = useAuth();
  
  const lists = useNotebookStore((s) => s.lists);
  const [events, setEvents] = useState<CalEvent[]>([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase
        .from("calendar_events")
        .select("id,title,category,event_date,recurring_weekday,high_priority,supplier");
      if (mounted && data) setEvents(data as CalEvent[]);
    })();
    return () => {
      mounted = false;
    };
  }, []);



  const todayEvents = useMemo(() => {
    const iso = todayIso();
    const wd = new Date(iso + "T00:00:00").getDay();
    return events.filter(
      (e) => e.event_date === iso || e.recurring_weekday === wd,
    );
  }, [events]);

  const tomorrowDeliveries = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const wd = d.getDay();
    return events.filter(
      (e) =>
        e.category === "delivery" &&
        (e.event_date === iso || e.recurring_weekday === wd),
    );
  }, [events]);

  const openTasks = lists.tasks.filter((t) => !t.done).length;
  const shoppingCount = lists.shopping.filter((t) => !t.done).length;
  const ordersCount = lists.orders.filter((t) => !t.done).length;

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
  const weatherTitle = useSiteText("home.weather_title", "מזג אוויר — מודיעין");
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
        <h1 className="font-display text-3xl sm:text-4xl font-bold leading-tight text-foreground">
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
        <p className="text-foreground/80 mt-2 text-sm leading-relaxed">
          {homeSubtitle} <span className="text-foreground/60">• {dateLabel}</span>
        </p>
      </div>

      {/* Weather widget */}
      <div className="mb-6">
        <WeatherWidget title={weatherTitle} alertText={rainAlert} />
      </div>

      {/* EV charging widget */}
      <div className="mb-6">
        <EvChargingWidget />
      </div>

      {/* Live operational telemetry */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        <CurrentShiftProgressCard />
        <DoughStatusCard />
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <StatCard label="משימות פתוחות" value={openTasks} to="/notebook" />
        <StatCard label="אירועים היום" value={todayEvents.length} to="/calendar" highlight tourId="stat-events-today" />
        <StatCard label="פריטים לקנייה" value={shoppingCount} to="/notebook" />
      </div>

      {/* Quick Access Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Today's Schedule */}
        <Link
          to="/calendar"
          className="group rounded-xl border-2 border-jungle/30 hover:border-neon bg-card p-5 transition flex flex-col gap-3"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-neon" />
              <h2 className="font-display text-lg font-bold">📅 לוח אירועים – היום</h2>
            </div>
            <span className="text-xs text-foreground/70">{WEEKDAYS_HE[today.getDay()]}</span>
          </div>
          {todayEvents.length === 0 ? (
            <p className="text-sm text-foreground/80">אין אירועים מתוזמנים להיום.</p>
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
                    <span className="text-[10px] text-foreground/70 shrink-0">{e.supplier}</span>
                  )}
                </li>
              ))}
              {todayEvents.length > 4 && (
                <li className="text-xs text-foreground/70">+ {todayEvents.length - 4} נוספים</li>
              )}
            </ul>
          )}
          <span className="text-xs text-neon font-bold mt-auto group-hover:underline">
            פתח לוח מלא →
          </span>
        </Link>

        {/* Daily Notebook */}
        <Link
          to="/notebook"
          data-tour="card-notebook"
          className="group rounded-xl border-2 border-jungle/30 hover:border-neon bg-card p-5 transition flex flex-col gap-3"
        >
          <div className="flex items-center gap-2">
            <StickyNote className="h-5 w-5 text-neon" />
            <h2 className="font-display text-lg font-bold">📝 פנקס הערות ומשימות</h2>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <NotebookMini label="משימות" value={openTasks} />
            <NotebookMini label="קניות" value={shoppingCount} />
            <NotebookMini label="הזמנות" value={ordersCount} />
          </div>
          <span className="text-xs text-neon font-bold mt-auto group-hover:underline">
            פתח פנקס →
          </span>
        </Link>
      </div>

      {/* Supplier reminders — tomorrow */}
      {tomorrowDeliveries.length > 0 && (
        <Link
          to="/calendar"
          className="block mb-6 rounded-xl border-2 border-neon/40 hover:border-neon bg-neon/5 p-4 transition"
        >
          <div className="flex items-center gap-2 mb-2">
            <Truck className="h-5 w-5 text-neon" />
            <h2 className="font-display text-base font-bold">
              🔔 תזכורת — מחר מגיעים {tomorrowDeliveries.length} ספקים
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

      {/* Shortcut tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <ShortcutTile to="/tasks" icon={<ClipboardCheck className="h-5 w-5" />} label="צ'ק-ליסט משמרות" tourId="tile-tasks" />
        <ShortcutTile to="/recipes" icon={<ChefHat className="h-5 w-5" />} label="כל המתכונים" tourId="tile-recipes" />
        <ShortcutTile to="/notebook" icon={<StickyNote className="h-5 w-5" />} label="פנקס הערות ומשימות" />
        <ShortcutTile to="/prep" icon={<ChefHat className="h-5 w-5" />} label="הכנות יומיות" tourId="tile-prep" />
        <ShortcutTile to="/restock" icon={<Truck className="h-5 w-5" />} label="השלמות מהמחסן" tourId="tile-restock" />
        <ShortcutTile to="/suppliers" icon={<Truck className="h-5 w-5" />} label="ניהול ספקים" tourId="tile-suppliers" />
        {role === "admin" && (
          <ShortcutTile to="/admin" icon={<ShieldCheck className="h-5 w-5" />} label="מערכת ניהול" tourId="tile-admin" />
        )}
      </div>
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
      className={`rounded-xl border-2 p-4 text-right transition hover:border-neon ${
        highlight ? "border-neon glow-neon bg-neon/5" : "border-jungle/30 bg-jungle/5"
      }`}
    >
      <div className="text-[10px] uppercase tracking-[0.2em] text-foreground/70 font-bold">
        {label}
      </div>
      <div className="font-display text-3xl font-black text-neon tabular-nums mt-1">
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
      <div className="text-[10px] text-foreground/70 mt-1">{label}</div>
    </div>
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
      className="rounded-xl border border-jungle/30 hover:border-neon hover:text-neon bg-card p-4 flex flex-col items-center justify-center gap-2 text-center transition"
    >
      <div className="text-neon">{icon}</div>
      <span className="text-sm font-bold">{label}</span>
    </Link>
  );
}
