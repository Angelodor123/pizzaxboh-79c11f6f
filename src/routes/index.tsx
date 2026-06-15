import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ChefHat, ClipboardCheck, Truck, ShieldCheck, StickyNote } from "lucide-react";
import { useNotebookStore } from "@/lib/notebook-store";
import { useSiteText } from "@/lib/site-texts";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { WeatherWidget } from "@/components/WeatherWidget";
import { EvChargingWidget } from "@/components/EvChargingWidget";
import { DoughStatusCard } from "@/components/DoughStatusCard";
import { CurrentShiftProgressCard } from "@/components/CurrentShiftProgressCard";
import { SupplierAlertsBanner } from "@/components/SupplierAlertsBanner";
import { useBranchFeature, useActiveBranchData } from "@/components/BranchGate";
import { withBranch } from "@/lib/branch-scope";
import { PersonalTasksCard } from "@/components/PersonalTasksCard";
import { NotificationPermissionBanner } from "@/components/NotificationPermissionBanner";


import { ShiftFeedCard } from "@/components/ShiftFeedCard";


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

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function OperationalDashboard() {
  const { role, isSuperAdmin } = useAuth();
  const vehiclesEnabled = useBranchFeature("vehicles", true);
  const activeBranch = useActiveBranchData();

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
  void todayEvents;

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
  const notebookTotal = openTasks + shoppingCount + ordersCount + shortagesCount;

  const today = new Date();
  const dateLabel = today.toLocaleDateString("he-IL", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  // Site texts kept for compatibility but no longer rendered in the header.
  useSiteText("home.title", "ברוכים הבאים למרכז השליטה של Pizza X");
  useSiteText(
    "home.subtitle",
    "מרכז הבקרה התפעולי של המטבח. הנה תמונת מצב יומית מהירה לכל מה שקורה היום במטבח.",
  );
  const rainAlert = useSiteText(
    "home.rain_alert",
    "⚠️ צפי לגשם, אין לפתוח שולחנות וכיסאות בחוץ",
  );

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Compact status bar */}
      <div
        className="mb-4 py-3 flex items-center justify-between gap-3 border-b border-border/60"
        data-tour="home-header"
        dir="rtl"
      >
        <span className="text-sm text-muted-foreground">{dateLabel}</span>
        <span className="text-sm font-bold text-foreground truncate">
          {activeBranch?.name ?? ""}
        </span>
        <span className="w-0" />
      </div>

      <NotificationPermissionBanner />

      {/* Weather strip + EV */}
      <div className="mb-4 space-y-2">
        <WeatherWidget alertText={rainAlert} />
        {vehiclesEnabled && <EvChargingWidget />}
      </div>

      {/* Supplier ordering alerts — must order today */}
      <SupplierAlertsBanner />

      {/* Shift feed + personal tasks: stacked on mobile, side-by-side on lg */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4 items-start">
        <div data-tour="shift-feed">
          <ShiftFeedCard />
        </div>
        <PersonalTasksCard />
      </div>

      {/* Dough + current shift progress — compact side by side */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6 items-start">
        <CurrentShiftProgressCard />
        <DoughStatusCard />
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
              <ShortcutTile to="/notebook" icon={<StickyNote className="h-5 w-5" />} label="פנקס הערות ומשימות" badgeCount={notebookTotal} />
              <ShortcutTile to="/aids" icon={<ChefHat className="h-5 w-5" />} label="ספריית עזרים" tourId="tile-aids" />
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
                  <ShortcutTile to="/admin" icon={<ShieldCheck className="h-5 w-5" />} label="פאנל ניהול" tourId="tile-admin" />
                </div>
              </>
            )}
          </>
        );
      })()}
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
  badgeCount,
}: {
  to: string;
  icon: React.ReactNode;
  label: string;
  tourId?: string;
  badgeCount?: number;
}) {
  return (
    <Link
      to={to}
      data-tour={tourId}
      aria-label={label}
      className="relative rounded-xl border border-jungle/30 hover:border-neon hover:text-neon bg-card p-4 min-h-20 flex flex-col items-center justify-center gap-2 text-center transition"
    >
      {badgeCount !== undefined && badgeCount > 0 && (
        <span className="absolute top-2 left-2 rounded-full bg-neon text-primary-foreground text-[10px] font-bold px-1.5 py-0.5 min-w-[18px] text-center">
          {badgeCount}
        </span>
      )}
      <div className="text-neon">{icon}</div>
      <span className="text-sm font-bold leading-snug">{label}</span>
    </Link>
  );
}
