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
  ChefHat,
  Building2,
  Boxes,
  ListChecks,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { PrepItemsPanel, RestockItemsPanel } from "@/components/admin/ParLevelPanels";
import { BranchesPanel } from "@/components/admin/BranchesPanel";
import { TasksPanel } from "@/components/admin/TasksPanel";

export const Route = createFileRoute("/admin-hub")({
  component: AdminHubGate,
});

type TabKey =
  | "users"
  | "tasks"
  | "recipes"
  | "branches"
  | "stock"
  | "catalog"
  | "deliveries"
  | "contacts";

const TABS: { key: TabKey; label: string; icon: React.ReactNode; superAdminOnly?: boolean }[] = [
  { key: "users", label: "👥 משתמשים", icon: <Users className="h-4 w-4" /> },
  { key: "tasks", label: "📝 משימות קבועות", icon: <ListChecks className="h-4 w-4" />, superAdminOnly: true },
  { key: "recipes", label: "👨‍🍳 מתכונים", icon: <ChefHat className="h-4 w-4" /> },
  { key: "branches", label: "🏢 סניפים", icon: <Building2 className="h-4 w-4" />, superAdminOnly: true },
  { key: "stock", label: "📦 מלאי יומי", icon: <Boxes className="h-4 w-4" /> },
  { key: "catalog", label: "🧾 קטלוג ועלויות", icon: <Package className="h-4 w-4" /> },
  { key: "deliveries", label: "🚚 ביקורת משלוחים", icon: <Truck className="h-4 w-4" /> },
  { key: "contacts", label: "📞 אנשי קשר", icon: <Phone className="h-4 w-4" /> },
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
  const { isSuperAdmin } = useAuth();
  const [tab, setTab] = useState<TabKey>("users");

  const visibleTabs = TABS.filter((t) => !t.superAdminOnly || isSuperAdmin);

  return (
    <div className="max-w-5xl mx-auto px-4 py-6" dir="rtl">
      <header className="mb-6">
        <h1 className="font-display text-3xl font-black text-neon">פאנל ניהול מרכזי</h1>
        <p className="text-sm text-muted-foreground mt-1">
          כל כלי הניהול במקום אחד.
        </p>
      </header>

      <div className="flex flex-wrap gap-2 mb-6 border-b border-border pb-3">
        {visibleTabs.map((t) => (
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
        {tab === "tasks" && isSuperAdmin && <TasksPanel />}
        {tab === "recipes" && <RecipesTab />}
        {tab === "branches" && isSuperAdmin && <BranchesPanel />}
        {tab === "stock" && <StockTab />}
        {tab === "catalog" && <CatalogTab />}
        {tab === "deliveries" && <DeliveriesTab />}
        {tab === "contacts" && <ContactsTab />}
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

// ============= RECIPES =============
function RecipesTab() {
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    void (async () => {
      const { count: c } = await supabase
        .from("recipes")
        .select("id", { count: "exact", head: true });
      setCount(c ?? 0);
    })();
  }, []);
  return (
    <section className="space-y-4">
      <h2 className="font-display text-xl font-bold">👨‍🍳 מתכונים</h2>
      <p className="text-sm text-muted-foreground">
        עריכת ספר המתכונים — מרכיבים, כמויות, שלבים והיסטוריית גרסאות.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <Stat label="מתכונים פעילים" value={count ?? "…"} accent />
      </div>
      <div className="flex gap-2 flex-wrap">
        <GoLink to="/admin" label="פתח עורך מתכונים" />
        <GoLink to="/recipes" label="ספר המתכונים" />
      </div>
    </section>
  );
}

// ============= STOCK (Prep + Restock unified) =============
function StockTab() {
  const [mode, setMode] = useState<"prep" | "restock">("prep");
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-display text-xl font-bold">📦 מלאי יומי</h2>
          <p className="text-sm text-muted-foreground">
            יעדי כמויות יומיים — הכנות מטבח (בצק, רטבים) והשלמות מהמחסן (אריזה, מתכלים).
          </p>
        </div>
        <div className="inline-flex rounded-full border border-border bg-background/40 p-1">
          <button
            type="button"
            onClick={() => setMode("prep")}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition ${
              mode === "prep" ? "bg-neon text-primary-foreground" : "text-foreground/70 hover:text-foreground"
            }`}
          >
            🧑‍🍳 הכנות
          </button>
          <button
            type="button"
            onClick={() => setMode("restock")}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition ${
              mode === "restock" ? "bg-neon text-primary-foreground" : "text-foreground/70 hover:text-foreground"
            }`}
          >
            📦 השלמות
          </button>
        </div>
      </div>
      <div className="rounded-lg border border-border bg-background/20 p-4">
        {mode === "prep" ? <PrepItemsPanel /> : <RestockItemsPanel />}
      </div>
      <p className="text-xs text-muted-foreground">
        טיפ: שני הכלים זהים במבנה — הכנות מנוהלות על ידי המטבח, השלמות נספרות מול המחסן ויכולות לכלול ברקוד.
      </p>
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
      <h2 className="font-display text-xl font-bold">🧾 קטלוג ועלויות</h2>
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
        .select("id, product_name, reason, expected_qty, actual_qty, resolved, created_at")
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
                <div className="text-sm font-bold truncate">{e.product_name || "פריט"}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {new Date(e.created_at).toLocaleDateString("he-IL")}
                  {e.expected_qty != null && e.actual_qty != null
                    ? ` · צפוי ${e.expected_qty} · התקבל ${e.actual_qty}`
                    : ""}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span
                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-bold ${
                    e.resolved
                      ? "bg-neon/10 text-neon border-neon/40"
                      : "bg-pink-500/15 text-pink-300 border-pink-500/40"
                  }`}
                >
                  <AlertTriangle className="h-3 w-3" />
                  {e.reason === "missing"
                    ? "חסר"
                    : e.reason === "damaged"
                      ? "פגום"
                      : e.reason || "חריגה"}
                </span>
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
