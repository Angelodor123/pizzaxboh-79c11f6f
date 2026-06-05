import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Users,
  Package,
  Truck,
  Phone,
  ClipboardList,
  ShieldAlert,
  ArrowLeft,
  AlertTriangle,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin-hub")({
  component: AdminHubGate,
});

type TabKey = "users" | "catalog" | "deliveries" | "contacts" | "tasks";

const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: "users", label: "👥 משתמשים", icon: <Users className="h-4 w-4" /> },
  { key: "catalog", label: "📦 קטלוג ועלויות", icon: <Package className="h-4 w-4" /> },
  { key: "deliveries", label: "🚚 ביקורת משלוחים", icon: <Truck className="h-4 w-4" /> },
  { key: "contacts", label: "📞 אנשי קשר", icon: <Phone className="h-4 w-4" /> },
  { key: "tasks", label: "📝 משימות", icon: <ClipboardList className="h-4 w-4" /> },
];

function AdminHubGate() {
  const { role, loading } = useAuth();
  if (loading) {
    return <div className="p-8 text-center text-muted-foreground">טוען…</div>;
  }
  if (role !== "admin") {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center" dir="rtl">
        <ShieldAlert className="h-10 w-10 text-neon mx-auto" />
        <h1 className="mt-4 font-display text-2xl font-bold">אין הרשאת ניהול</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          פאנל זה זמין למנהלים בלבד.
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center justify-center rounded-md bg-neon px-4 py-2 text-sm font-bold text-primary-foreground"
        >
          חזרה למטבח
        </Link>
      </div>
    );
  }
  return <AdminHub />;
}

function AdminHub() {
  const [tab, setTab] = useState<TabKey>("users");

  return (
    <div className="max-w-5xl mx-auto px-4 py-6" dir="rtl">
      <header className="mb-6">
        <h1 className="font-display text-3xl font-black text-neon">פאנל ניהול מרכזי</h1>
        <p className="text-sm text-muted-foreground mt-1">
          כל כלי הניהול במקום אחד — משתמשים, קטלוג, משלוחים, קשר ומשימות.
        </p>
      </header>

      <div className="flex flex-wrap gap-2 mb-6 border-b border-border pb-3">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold transition border ${
              tab === t.key
                ? "bg-neon text-primary-foreground border-neon shadow-[0_0_18px_-4px_rgba(57,255,20,0.7)]"
                : "bg-card text-foreground/80 border-border hover:border-neon/60 hover:text-foreground"
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      <div className="rounded-xl border-2 border-border bg-card p-5 min-h-[300px]">
        {tab === "users" && <UsersTab />}
        {tab === "catalog" && <CatalogTab />}
        {tab === "deliveries" && <DeliveriesTab />}
        {tab === "contacts" && <ContactsTab />}
        {tab === "tasks" && <TasksTab />}
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number | string; accent?: boolean }) {
  return (
    <div className={`rounded-lg border p-4 ${accent ? "border-neon bg-neon/10" : "border-border bg-background/40"}`}>
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">{label}</div>
      <div className="font-display text-2xl font-black text-neon tabular-nums mt-1">{value}</div>
    </div>
  );
}

function GoLink({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      className="inline-flex items-center gap-1 rounded-md bg-neon px-4 py-2 text-sm font-bold text-primary-foreground hover:opacity-90"
    >
      {label}
      <ArrowLeft className="h-4 w-4" />
    </Link>
  );
}

// ============= USERS =============
function UsersTab() {
  const [count, setCount] = useState<number | null>(null);
  const [pending, setPending] = useState<number | null>(null);
  useEffect(() => {
    void (async () => {
      const { data } = await (supabase.rpc as any)("list_user_directory");
      const rows = (data ?? []) as any[];
      setCount(rows.filter((r) => r.kind === "user").length);
      setPending(rows.filter((r) => r.kind === "invite").length);
    })();
  }, []);
  return (
    <section className="space-y-4">
      <h2 className="font-display text-xl font-bold">👥 ניהול משתמשים</h2>
      <p className="text-sm text-muted-foreground">
        ניהול תפקידים, מחלקה (מטבח/דלפק/שליחים/הנהלה), ותק, טלפון וכתובת בית (פרטית).
      </p>
      <div className="grid grid-cols-2 gap-3">
        <Stat label="משתמשים פעילים" value={count ?? "…"} accent />
        <Stat label="הזמנות ממתינות" value={pending ?? "…"} />
      </div>
      <GoLink to="/admin" label="פתח ניהול משתמשים" />
    </section>
  );
}

// ============= CATALOG =============
function CatalogTab() {
  const [products, setProducts] = useState<number | null>(null);
  const [corrections, setCorrections] = useState<number | null>(null);
  useEffect(() => {
    void (async () => {
      const [p, c] = await Promise.all([
        supabase.from("supplier_products").select("id", { count: "exact", head: true }).eq("active", true),
        supabase.from("mapping_corrections").select("id", { count: "exact", head: true }),
      ]);
      setProducts(p.count ?? 0);
      setCorrections(c.count ?? 0);
    })();
  }, []);
  return (
    <section className="space-y-4">
      <h2 className="font-display text-xl font-bold">📦 קטלוג ועלויות</h2>
      <p className="text-sm text-muted-foreground">
        עריכת מוצרים, עדכון מחיר עלות (<code>cost_price</code>), וצפייה בתיקוני מיפוי שבוצעו על ידי הצוות.
        המחירים מתעדכנים אוטומטית בכל סריקת קבלה דרך מודול קליטת הסחורה.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <Stat label="מוצרים בקטלוג" value={products ?? "…"} accent />
        <Stat label="תיקוני מיפוי" value={corrections ?? "…"} />
      </div>
      <div className="flex gap-2 flex-wrap">
        <GoLink to="/suppliers" label="פתח קטלוג ספקים" />
        <GoLink to="/invoices" label="קליטת סחורה" />
      </div>
    </section>
  );
}

// ============= DELIVERIES AUDIT =============
function DeliveriesTab() {
  const [exceptions, setExceptions] = useState<any[]>([]);
  const [loadingD, setLoadingD] = useState(true);
  useEffect(() => {
    void (async () => {
      const { data } = await supabase
        .from("delivery_exceptions")
        .select("id, item_name, exception_type, quantity, supplier_name, created_at")
        .order("created_at", { ascending: false })
        .limit(20);
      setExceptions((data ?? []) as any[]);
      setLoadingD(false);
    })();
  }, []);
  return (
    <section className="space-y-4">
      <h2 className="font-display text-xl font-bold">🚚 ביקורת משלוחים</h2>
      <p className="text-sm text-muted-foreground">
        דוחות חריגות מקבלות סחורה: פריטים חסרים, פגומים או הפרשי כמויות.
      </p>
      {loadingD ? (
        <p className="text-sm text-muted-foreground">טוען...</p>
      ) : exceptions.length === 0 ? (
        <p className="text-sm text-muted-foreground">אין חריגות אחרונות. ✓</p>
      ) : (
        <ul className="space-y-2">
          {exceptions.map((e) => (
            <li
              key={e.id}
              className="rounded-md border border-border bg-background/40 p-3 flex items-center justify-between gap-2"
            >
              <div className="min-w-0">
                <div className="text-sm font-bold truncate">{e.item_name || "פריט"}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {e.supplier_name || "—"} · {new Date(e.created_at).toLocaleDateString("he-IL")}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="inline-flex items-center gap-1 rounded-full bg-pink-500/15 text-pink-300 border border-pink-500/40 px-2.5 py-1 text-[11px] font-bold">
                  <AlertTriangle className="h-3 w-3" />
                  {e.exception_type === "missing" ? "חסר" : e.exception_type === "damaged" ? "פגום" : e.exception_type}
                </span>
                {e.quantity != null && (
                  <span className="text-xs text-muted-foreground tabular-nums">×{e.quantity}</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      <GoLink to="/invoices" label="פתח מודול קבלת סחורה" />
    </section>
  );
}

// ============= CONTACTS =============
function ContactsTab() {
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    void (async () => {
      const { count: c } = await supabase
        .from("emergency_contacts")
        .select("id", { count: "exact", head: true });
      setCount(c ?? 0);
    })();
  }, []);
  return (
    <section className="space-y-4">
      <h2 className="font-display text-xl font-bold">📞 אנשי קשר חירום</h2>
      <p className="text-sm text-muted-foreground">
        ניהול אנשי קשר זמינים בשעת חירום — חשמלאי, שרברב, איש שירות לתנור, מוקד תקלות ועוד.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <Stat label="אנשי קשר רשומים" value={count ?? "…"} accent />
      </div>
      <div className="flex gap-2 flex-wrap">
        <GoLink to="/aids/contacts" label="פתח אנשי קשר חירום" />
        <GoLink to="/aids/staff" label="דף קשר צוות" />
      </div>
    </section>
  );
}

// ============= TASKS =============
function TasksTab() {
  const [tasks, setTasks] = useState<number | null>(null);
  const [groups, setGroups] = useState<number | null>(null);
  useEffect(() => {
    void (async () => {
      const [t, g] = await Promise.all([
        supabase.from("tasks").select("id", { count: "exact", head: true }).eq("active", true),
        supabase.from("task_groups").select("id", { count: "exact", head: true }).eq("active", true),
      ]);
      setTasks(t.count ?? 0);
      setGroups(g.count ?? 0);
    })();
  }, []);
  return (
    <section className="space-y-4">
      <h2 className="font-display text-xl font-bold">📝 משימות וקטגוריות</h2>
      <p className="text-sm text-muted-foreground">
        ניהול משימות חוזרות, קטגוריות וקבוצות משימה לכל משמרת.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <Stat label="משימות פעילות" value={tasks ?? "…"} accent />
        <Stat label="קבוצות משימה" value={groups ?? "…"} />
      </div>
      <GoLink to="/admin" label="פתח ניהול משימות" />
    </section>
  );
}
