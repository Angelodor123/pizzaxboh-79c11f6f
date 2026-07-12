import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ChefHat, ClipboardCheck, Truck, ShieldCheck, StickyNote, Package, AlertTriangle, CheckCircle2, ChevronLeft } from "lucide-react";
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
import { Skeleton } from "@/components/ui/skeleton";
import { getActiveBranchIdSync } from "@/lib/current-branch";


import { ShiftFeedCard } from "@/components/ShiftFeedCard";


export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: 'Pizza X — מערכת ניהול מטבח' },
      { name: "description", content: 'מסך הבית של מערכת ניהול המטבח של Pizza X.' },
    
      { property: "og:title", content: 'Pizza X — מערכת ניהול מטבח' },
      { property: "og:description", content: 'מסך הבית של מערכת ניהול המטבח של Pizza X.' },
      { property: "og:url", content: "https://pizzaxboh.lovable.app/" },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: "https://pizzaxboh.lovable.app/" }],
  }),
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

type ShiftPeriod = "morning" | "evening" | "closing";
interface ShiftContext {
  greeting: string;
  shiftPeriod: ShiftPeriod;
  priorityOrder: string[];
}
function getShiftContext(): ShiftContext {
  const parts = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    hour12: false,
    timeZone: "Asia/Jerusalem",
  }).formatToParts(new Date());
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  if (hour >= 9 && hour <= 16) {
    return { greeting: "בוקר טוב", shiftPeriod: "morning", priorityOrder: ["prep", "tasks", "notebook"] };
  }
  if (hour >= 17 || hour <= 5) {
    return { greeting: "ערב טוב", shiftPeriod: "evening", priorityOrder: ["tasks", "notebook", "restock"] };
  }
  return { greeting: "בוקר טוב", shiftPeriod: "closing", priorityOrder: ["notebook", "maintenance", "tasks"] };
}

function OperationalDashboard() {
  const { role, isSuperAdmin } = useAuth();
  const vehiclesEnabled = useBranchFeature("vehicles", true);
  const activeBranch = useActiveBranchData();
  const shiftCtx = getShiftContext();


  const lists = useNotebookStore((s) => s.lists);
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [overrides, setOverrides] = useState<CalOverride[]>([]);
  const [loadingHome, setLoadingHome] = useState(true);
  const [tasksOpenCount, setTasksOpenCount] = useState(0);
  const [prepOpenCount, setPrepOpenCount] = useState(0);
  const [goodsMenuOpen, setGoodsMenuOpen] = useState(false);


  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const ev = await withBranch(
        supabase
          .from("calendar_events")
          .select("id,title,category,event_date,recurring_weekday,high_priority,supplier")
          .limit(200),
      );
      if (!mounted) return;
      const evData = (ev.data ?? []) as CalEvent[];
      setEvents(evData);
      const eventIds = evData.map((e) => e.id);
      if (eventIds.length === 0) {
        setOverrides([]);
        setLoadingHome(false);
        return;
      }
      const ov = await supabase
        .from("calendar_event_overrides")
        .select("event_id,override_date,deleted,order_verification_status")
        .in("event_id", eventIds);
      if (!mounted) return;
      if (ov.data) setOverrides(ov.data as CalOverride[]);
      setLoadingHome(false);
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

  // Live badge counts for tasks + prep tiles
  useEffect(() => {
    let mounted = true;
    const today = todayIso();
    const loadCounts = async () => {
      const branchId = getActiveBranchIdSync();

      // Tasks: total active tasks (branch-scoped) minus those completed today
      let tasksQuery = supabase.from("tasks").select("id").eq("active", true);
      if (branchId) tasksQuery = tasksQuery.eq("branch_id", branchId);
      const { data: tasksData } = await tasksQuery;
      const taskIds = (tasksData ?? []).map((t: any) => t.id);
      let tasksDone = 0;
      if (taskIds.length > 0) {
        const { count } = await supabase
          .from("daily_task_logs")
          .select("id", { count: "exact", head: true })
          .eq("log_date", today)
          .eq("completed", true)
          .in("task_id", taskIds);
        tasksDone = count ?? 0;
      }
      if (!mounted) return;
      setTasksOpenCount(Math.max(0, (tasksData?.length ?? 0) - tasksDone));

      // Prep: total active prep items (branch-scoped) minus completed today
      let prepQuery = supabase.from("prep_items").select("id").eq("active", true);
      if (branchId) prepQuery = prepQuery.eq("branch_id", branchId);
      const { data: prepData } = await prepQuery;
      const prepIds = (prepData ?? []).map((p: any) => p.id);
      let prepDone = 0;
      if (prepIds.length > 0) {
        const { count } = await supabase
          .from("prep_log")
          .select("id", { count: "exact", head: true })
          .eq("log_date", today)
          .eq("completed", true)
          .in("prep_item_id", prepIds);
        prepDone = count ?? 0;
      }
      if (!mounted) return;
      setPrepOpenCount(Math.max(0, (prepData?.length ?? 0) - prepDone));
    };
    void loadCounts();
    const interval = setInterval(() => void loadCounts(), 30000);
    return () => {
      mounted = false;
      clearInterval(interval);
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
        <span className="text-sm truncate flex items-center gap-1.5">
          <span className="text-neon font-bold">{shiftCtx.greeting}</span>
          <span className="text-muted-foreground">·</span>
          <span className="font-bold text-foreground truncate">{activeBranch?.name ?? ""}</span>
        </span>
        <span className="w-0" />
      </div>

      {/* Current shift progress — hero card */}
      <div className="mb-4 rounded-2xl border-2 border-neon/30 bg-gradient-to-br from-neon/5 to-transparent p-1 shadow-[0_0_24px_-8px_rgba(57,255,20,0.2)]">
        <CurrentShiftProgressCard />
      </div>

      {/* Next action strip */}
      {(() => {
        const iconCls = "h-5 w-5 shrink-0";
        const textCls = "text-sm font-bold flex-1";
        const wrapCls = "rounded-xl border border-border bg-card/40 px-4 py-3 flex items-center gap-3 mb-4";
        let content: React.ReactNode = null;
        let to: string | null = null;
        if (shiftCtx.shiftPeriod === "morning" && prepOpenCount > 0) {
          to = "/prep";
          content = (<><ChefHat className={`${iconCls} text-orange-400`} /><span className={textCls}>יש {prepOpenCount} הכנות שממתינות</span></>);
        } else if (tasksOpenCount > 0) {
          to = "/tasks";
          content = (<><ClipboardCheck className={`${iconCls} text-amber-400`} /><span className={textCls}>יש {tasksOpenCount} משימות פתוחות</span></>);
        } else if (shortagesCount > 0) {
          to = "/notebook";
          content = (<><AlertTriangle className={`${iconCls} text-amber-400`} /><span className={textCls}>יש {shortagesCount} חוסרים פתוחים</span></>);
        } else {
          content = (<><CheckCircle2 className={`${iconCls} text-neon`} /><span className={textCls}>הכל מסודר להיום</span></>);
        }
        return to ? (
          <Link to={to} className={wrapCls}>
            <ChevronLeft className="h-4 w-4 text-muted-foreground" />
            {content}
          </Link>
        ) : (
          <div className={wrapCls}>{content}</div>
        );
      })()}

      {/* Quick-access notebook */}
      <Link
        to="/notebook"
        className="mb-4 rounded-2xl border-2 border-neon/30 hover:border-neon bg-card/60 hover:bg-neon/5 p-4 flex items-center gap-4 transition"
      >
        <StickyNote className="h-7 w-7 text-neon shrink-0" />
        <div className="flex-1">
          <span className="text-base font-bold block">פנקס עבודה</span>
          <span className="text-xs text-muted-foreground">פנקס, רשימת קניות, משימות אישיות</span>
        </div>
        {notebookTotal > 0 && (
          <span className="inline-flex items-center justify-center rounded-full bg-neon/20 text-neon text-xs font-bold h-6 min-w-6 px-1.5">
            {notebookTotal}
          </span>
        )}
      </Link>

      {shortagesCount > 0 && (
        <Link
          to="/notebook"
          className="mb-4 flex items-center gap-3 rounded-xl border-2 border-amber-500/50 bg-amber-500/10 hover:bg-amber-500/15 px-4 py-3 transition"
        >
          <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0" />
          <div className="flex-1">
            <div className="text-sm font-bold text-amber-300">{shortagesCount} חוסרים פתוחים</div>
            <div className="text-xs text-amber-400/70">לחץ לפתיחת הפנקס</div>
          </div>
          <ChevronLeft className="h-4 w-4 text-amber-400" />
        </Link>
      )}

      {/* Dough — standalone */}
      <div className="mb-4">
        <DoughStatusCard />
      </div>

      <NotificationPermissionBanner />

      {/* Supplier ordering alerts — must order today */}
      <SupplierAlertsBanner />

      {/* Weather strip + EV */}
      <div className="mb-4 space-y-2">
        <WeatherWidget alertText={rainAlert} />
        {vehiclesEnabled && <EvChargingWidget />}
      </div>

      {/* Two large action buttons */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <Link
          to="/recipes"
          className="rounded-2xl border-2 border-neon/30 hover:border-neon bg-card/60 hover:bg-neon/5 p-5 flex flex-col items-center justify-center gap-2 text-center transition min-h-32"
        >
          <ChefHat className="h-8 w-8 text-neon" />
          <span className="text-lg font-bold">ספר המתכונים</span>
          <span className="text-xs text-muted-foreground">מתכונים, רטבים, בסיסים</span>
        </Link>
        <button
          type="button"
          onClick={() => setGoodsMenuOpen(true)}
          className="rounded-2xl border-2 border-neon/30 hover:border-neon bg-card/60 hover:bg-neon/5 p-5 flex flex-col items-center justify-center gap-2 text-center transition min-h-32"
        >
          <Truck className="h-8 w-8 text-neon" />
          <span className="text-lg font-bold">ניהול סחורה</span>
          <span className="text-xs text-muted-foreground">קבלה, הזמנות, ספקים</span>
        </button>
      </div>

      {/* Goods management picker */}
      {goodsMenuOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setGoodsMenuOpen(false)}
        >
          <div
            dir="rtl"
            className="w-full max-w-md rounded-2xl border-2 border-neon/40 bg-card p-5 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-bold">ניהול סחורה</h3>
              <button
                type="button"
                onClick={() => setGoodsMenuOpen(false)}
                className="text-muted-foreground hover:text-foreground text-xl leading-none"
                aria-label="סגור"
              >
                ×
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Link
                to="/invoices"
                onClick={() => setGoodsMenuOpen(false)}
                className="rounded-xl border-2 border-neon/30 hover:border-neon bg-card/60 hover:bg-neon/5 p-4 flex flex-col items-center gap-2 text-center transition min-h-28"
              >
                <ClipboardCheck className="h-7 w-7 text-neon" />
                <span className="text-sm font-bold">קבלת סחורה</span>
                <span className="text-[11px] text-muted-foreground">חשבוניות ותעודות</span>
              </Link>
              <Link
                to="/orders"
                onClick={() => setGoodsMenuOpen(false)}
                className="rounded-xl border-2 border-neon/30 hover:border-neon bg-card/60 hover:bg-neon/5 p-4 flex flex-col items-center gap-2 text-center transition min-h-28"
              >
                <Truck className="h-7 w-7 text-neon" />
                <span className="text-sm font-bold">הזמנת סחורה</span>
                <span className="text-[11px] text-muted-foreground">שליחת הזמנות לספקים</span>
              </Link>
              <Link
                to="/restock"
                onClick={() => setGoodsMenuOpen(false)}
                className="rounded-xl border-2 border-neon/20 hover:border-neon bg-card/60 hover:bg-neon/5 p-4 flex flex-col items-center gap-2 text-center transition min-h-28"
              >
                <Package className="h-7 w-7 text-neon" />
                <span className="text-sm font-bold">השלמות מחסן</span>
                <span className="text-[11px] text-muted-foreground">בקשות מהמחסן</span>
              </Link>
              <Link
                to="/suppliers"
                onClick={() => setGoodsMenuOpen(false)}
                className="rounded-xl border-2 border-neon/20 hover:border-neon bg-card/60 hover:bg-neon/5 p-4 flex flex-col items-center gap-2 text-center transition min-h-28"
              >
                <Truck className="h-7 w-7 text-neon" />
                <span className="text-sm font-bold">ניהול ספקים</span>
                <span className="text-[11px] text-muted-foreground">קטלוגים ומחירונים</span>
              </Link>
            </div>
          </div>
        </div>
      )}




      {/* Supplier reminders — tomorrow */}
      {loadingHome ? (
        <Skeleton className="block mb-6 h-24 w-full rounded-xl" />
      ) : (
        tomorrowDeliveries.length > 0 && (
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
        )
      )}

      {/* Shift feed + personal tasks: stacked on mobile, side-by-side on lg */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4 items-start">
        <div data-tour="shift-feed">
          <ShiftFeedCard />
        </div>
        <PersonalTasksCard />
      </div>


      {/* Categorized shortcut sections (RBAC) */}
      {loadingHome ? (
        <div className="space-y-4">
          <Skeleton className="h-5 w-32" />
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-5 w-32" />
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-xl" />
            ))}
          </div>
        </div>
      ) : (() => {
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
              {(() => {
                const priorityMap: Record<string, string> = { prep: "/prep", tasks: "/tasks", notebook: "/notebook", restock: "/restock", maintenance: "/maintenance" };
                const primary: Record<string, React.ReactNode> = {
                  "/tasks": <ShortcutTile key="tasks" to="/tasks" icon={<ClipboardCheck className="h-6 w-6" />} label="צ'ק-ליסט משמרות" tourId="tile-tasks" badgeCount={tasksOpenCount} primary />,
                  "/prep": <ShortcutTile key="prep" to="/prep" icon={<ChefHat className="h-6 w-6" />} label="הכנות יומיות" tourId="tile-prep" badgeCount={prepOpenCount} primary />,
                  "/notebook": <ShortcutTile key="notebook" to="/notebook" icon={<StickyNote className="h-6 w-6" />} label="פנקס הערות ומשימות" badgeCount={notebookTotal} primary />,
                };
                const orderedRoutes = shiftCtx.priorityOrder.map((k) => priorityMap[k]).filter((r) => primary[r]);
                const shown = new Set(orderedRoutes);
                const rest = Object.keys(primary).filter((r) => !shown.has(r));
                return [...orderedRoutes, ...rest].map((r) => primary[r]);
              })()}
              <ShortcutTile to="/aids" icon={<ChefHat className="h-5 w-5" />} label="ספריית עזרים" tourId="tile-aids" />
            </div>

            {canLogistics && (
              <>
                <SectionHeader>לוגיסטיקה ומלאי</SectionHeader>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  <ShortcutTile to="/inventory" icon={<Package className="h-5 w-5" />} label="מלאי וסטוק" />

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
  primary,
}: {
  to: string;
  icon: React.ReactNode;
  label: string;
  tourId?: string;
  badgeCount?: number;
  primary?: boolean;
}) {
  return (
    <Link
      to={to}
      data-tour={tourId}
      aria-label={label}
      className={`relative rounded-xl border hover:border-neon hover:text-neon bg-card p-4 flex flex-col items-center justify-center gap-2 text-center transition ${
        primary ? "min-h-28 border-neon/20" : "min-h-20 border-jungle/30"
      }`}
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
