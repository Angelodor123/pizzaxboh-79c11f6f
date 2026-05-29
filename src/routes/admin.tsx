import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Trash2,
  Pencil,
  X,
  Check,
  UserPlus,
  ShieldAlert,
  History,
  RotateCcw,
  Users,
  ChefHat,
  Bell,
  FileText,
  Save,
} from "lucide-react";
import {
  categoryLabels,
  categoryOrder,
  type Ingredient,
  type Recipe,
  type RecipeCategory,
  type SpiceBag,
} from "@/lib/cookbook";
import { useCookbookStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { SortableList } from "@/components/SortableList";
import {
  useSiteTextsStore,
  useSupplierReminderSettings,
  type SupplierReminderSettings,
} from "@/lib/site-texts";
import { toast } from "sonner";
import { confirmDelete } from "@/lib/confirm";
import { useServerFn } from "@tanstack/react-start";
import { sendInvitationEmail } from "@/lib/invitations.functions";
import {
  adminUpdateUser,
  adminSuspendUser,
  adminReactivateUser,
  adminRevokeInvitation,
  adminUpdateInvitation,
} from "@/lib/admin-users.functions";
import { UnitsPanel, PrepItemsPanel, RestockItemsPanel, OnboardingPanel } from "@/components/admin/ParLevelPanels";
import { BranchesPanel } from "@/components/admin/BranchesPanel";
import { TasksPanel } from "@/components/admin/TasksPanel";
import { OverviewPanel } from "@/components/admin/OverviewPanel";
import { Building2, ListChecks, LayoutDashboard } from "lucide-react";
import { ModalDeleteButton } from "@/components/ModalDeleteButton";

export const Route = createFileRoute("/admin")({
  component: AdminGate,
  validateSearch: (search: Record<string, unknown>) => ({
    edit: typeof search.edit === "string" ? search.edit : undefined,
  }),
});

type AppRole = "super_admin" | "admin" | "manager" | "employee" | "viewer";

interface InvitationRow {
  id: string;
  email: string;
  role: AppRole;
  created_at: string;
  assigned_branch_id: string | null;
  full_name: string | null;
}

interface RoleRow {
  id: string;
  email: string;
  role: AppRole;
  user_id: string;
  assigned_branch_id: string | null;
}

interface BranchOption {
  id: string;
  name: string;
}

function AdminGate() {
  const { role, loading } = useAuth();
  if (loading) {
    return <div className="p-8 text-center text-muted-foreground">טוען…</div>;
  }
  if (role !== "admin") {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <ShieldAlert className="h-10 w-10 text-neon mx-auto" />
        <h1 className="mt-4 font-display text-2xl font-bold">אין הרשאת ניהול</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          עמוד זה זמין למשתמשי-על בלבד.
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
  return <AdminPage />;
}

// Super-admin user IDs are fetched server-side via the list_super_admin_user_ids RPC,
// avoiding hardcoding personal email addresses in the client bundle.

const CATEGORY_EMOJI: Record<RecipeCategory, string> = {
  dishes: "🍕",
  sauces_bases: "🍅",
  aiolis_sauces: "🍯",
  jams_creams: "🥘",
  starters: "🌽",
  spices: "🧂",
  croutons: "🥖",

  desserts: "🍪",
  pastas: "🍝",
  authentic_pastas: "🇮🇹",
  salads: "🥗",
};

const UNIT_OPTIONS = ["גרם", 'ק"ג', 'מ"ל', "ליטר", "יחידות", "כפות", "כפיות", "חופן", "פחיות"];

const EMPTY: Recipe = {
  id: "",
  category: "sauces_bases",
  nameHebrew: "",
  baseYieldHebrew: "",
  essenceHebrew: "",
  ingredients: [],
  instructionsHebrew: "",
  shelfLifeHebrew: "",
};

function AdminPage() {
  const recipes = useCookbookStore((s) => s.recipes);
  const addRecipe = useCookbookStore((s) => s.addRecipe);
  const updateRecipe = useCookbookStore((s) => s.updateRecipe);
  const softDeleteRecipe = useCookbookStore((s) => s.softDeleteRecipe);
  const search = Route.useSearch();
  const navigate = Route.useNavigate();

  const [editing, setEditing] = useState<Recipe | null>(null);
  const [filter, setFilter] = useState<RecipeCategory | "all">("all");
  const [query, setQuery] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [openedFromCard, setOpenedFromCard] = useState(false);

  useEffect(() => {
    setShowHistory(false);
  }, [editing?.id]);

  // Auto-open editor when ?edit=<recipeId> is present (from pencil on a recipe card)
  useEffect(() => {
    if (!search.edit) return;
    const target = recipes.find((r) => r.id === search.edit && !r.deleted);
    if (target) {
      setEditing({ ...target });
      setOpenedFromCard(true);
      navigate({ search: { edit: undefined }, replace: true });
    }
  }, [search.edit, recipes, navigate]);


  const q = query.trim();
  const visible = recipes
    .filter((r) => !r.deleted)
    .filter((r) => (filter === "all" ? true : r.category === filter))
    .filter((r) => (q ? r.nameHebrew.includes(q) : true));

  const startNew = () => {
    setOpenedFromCard(false);
    setEditing({ ...EMPTY, id: `recipe-${Date.now()}` });
  };

  const closeEditor = () => {
    setEditing(null);
    if (openedFromCard) {
      setOpenedFromCard(false);
      // Return the user to where they were when they pressed the edit button
      if (typeof window !== "undefined" && window.history.length > 1) {
        window.history.back();
      }
    }
  };

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const save = async () => {
    if (!editing) return;
    const name = editing.nameHebrew.trim();
    if (!name) {
      setSaveError("שם המתכון חובה");
      return;
    }
    if (name.length > 120) {
      setSaveError("שם המתכון ארוך מדי (עד 120 תווים)");
      return;
    }
    if ((editing.essenceHebrew ?? "").length > 500) {
      setSaveError("התיאור הקצר ארוך מדי (עד 500 תווים)");
      return;
    }
    if ((editing.instructionsHebrew ?? "").length > 10000) {
      setSaveError("ההוראות ארוכות מדי");
      return;
    }
    if (editing.ingredients.length > 100) {
      setSaveError("יותר מדי מרכיבים (עד 100)");
      return;
    }
    const cleaned: Recipe = {
      ...editing,
      nameHebrew: name,
      essenceHebrew: editing.essenceHebrew?.trim() || undefined,
      shelfLifeHebrew: editing.shelfLifeHebrew?.trim() || undefined,
      ingredients: editing.ingredients
        .filter((i) => i.name.trim())
        .map((i) => ({
          ...i,
          name: i.name.trim().slice(0, 120),
          quantity: Number.isFinite(i.quantity) && i.quantity >= 0 ? i.quantity : 0,
        })),
    };
    setSaving(true);
    setSaveError(null);
    try {
      const exists = recipes.some((r) => r.id === cleaned.id);
      if (exists) await updateRecipe(cleaned.id, cleaned);
      else await addRecipe(cleaned);
      closeEditor();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "שמירה נכשלה");
    } finally {
      setSaving(false);
    }
  };

  const { isSuperAdmin } = useAuth();
  const [tab, setTab] = useState<"overview" | "recipes" | "users" | "branches" | "tasks" | "reminders" | "cms" | "units" | "prep" | "restock" | "onboarding">("overview");

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <div className="mb-6 text-center">
        <div className="text-[10px] uppercase tracking-[0.3em] text-neon font-bold">
          Admin
        </div>
        <h1 className="font-display text-4xl font-bold mt-1">
          מערכת <span className="text-neon text-glow-neon">ניהול</span>
        </h1>
      </div>

      {/* Tabs */}
      <div className="mb-6 border-b border-border flex gap-1 overflow-x-auto scrollbar-hide" dir="rtl">
        <TabButton active={tab === "overview"} onClick={() => setTab("overview")} icon={<LayoutDashboard className="h-4 w-4" />}>
          סקירה כללית
        </TabButton>
        <TabButton active={tab === "recipes"} onClick={() => setTab("recipes")} icon={<ChefHat className="h-4 w-4" />}>
          מתכונים
        </TabButton>
        <TabButton active={tab === "users"} onClick={() => setTab("users")} icon={<Users className="h-4 w-4" />}>
          הרשאות
        </TabButton>
        {isSuperAdmin && (
          <TabButton active={tab === "branches"} onClick={() => setTab("branches")} icon={<Building2 className="h-4 w-4" />}>
            סניפים
          </TabButton>
        )}
        {isSuperAdmin && (
          <TabButton active={tab === "tasks"} onClick={() => setTab("tasks")} icon={<ListChecks className="h-4 w-4" />}>
            משימות קבועות
          </TabButton>
        )}
        <TabButton active={tab === "reminders"} onClick={() => setTab("reminders")} icon={<Bell className="h-4 w-4" />}>
          תזכורות ספקים
        </TabButton>
        <TabButton active={tab === "cms"} onClick={() => setTab("cms")} icon={<FileText className="h-4 w-4" />}>
          ניהול תוכן וטקסטים
        </TabButton>
        <TabButton active={tab === "onboarding"} onClick={() => setTab("onboarding")} icon={<FileText className="h-4 w-4" />}>
          הסברי דפים
        </TabButton>
        <TabButton active={tab === "units"} onClick={() => setTab("units")} icon={<FileText className="h-4 w-4" />}>
          יחידות מידה
        </TabButton>
        <TabButton active={tab === "prep"} onClick={() => setTab("prep")} icon={<ChefHat className="h-4 w-4" />}>
          הכנות יומיות
        </TabButton>
        <TabButton active={tab === "restock"} onClick={() => setTab("restock")} icon={<ChefHat className="h-4 w-4" />}>
          השלמות מהמחסן
        </TabButton>
      </div>

      {tab === "overview" && <OverviewPanel onGoToUsers={() => setTab("users")} />}

      {tab === "users" && (
        <div className="space-y-6">
          <InvitationsPanel />
          {isSuperAdmin && <SuperAdminUsersPanel />}
        </div>
      )}
      {tab === "branches" && isSuperAdmin && <BranchesPanel />}
      {tab === "tasks" && isSuperAdmin && <TasksPanel />}
      {tab === "reminders" && <SupplierRemindersPanel />}
      {tab === "cms" && <ContentTextsPanel />}
      {tab === "onboarding" && <OnboardingPanel />}
      {tab === "units" && <UnitsPanel />}
      {tab === "prep" && <PrepItemsPanel />}
      {tab === "restock" && <RestockItemsPanel />}

      {tab === "recipes" && (
        <section>
          <div className="mb-4 flex items-end justify-between gap-4 flex-wrap">
            <div>
              <h2 className="font-display text-xl font-bold text-right">
                ניהול מתכונים
              </h2>
              <p className="text-muted-foreground mt-1 text-sm">
                הוסף, ערוך ומחק מתכונים. השינויים מסונכרנים בענן בזמן אמת לכל המשתמשים.
              </p>
            </div>
            <button
              onClick={startNew}
              className="inline-flex items-center gap-2 bg-neon text-primary-foreground font-bold px-4 py-2 rounded-md glow-neon"
            >
              <Plus className="h-4 w-4" /> מתכון חדש
            </button>
          </div>

          <div className="mb-4 flex flex-col sm:flex-row gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="חיפוש מתכון..."
              className="flex-1 bg-input border border-border rounded-md px-3 py-2 text-sm text-right"
            />
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as RecipeCategory | "all")}
              className="bg-input border border-border rounded-md px-3 py-2 text-sm text-right font-bold focus:outline-none focus:ring-2 focus:ring-neon"
            >
              <option value="all">📋 כל הקטגוריות</option>
              {categoryOrder.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_EMOJI[c]} {categoryLabels[c]}
                </option>
              ))}
            </select>
          </div>

          <div className="border border-border rounded-md overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-card text-muted-foreground text-xs uppercase tracking-wider">
                <tr>
                  <th className="text-right px-3 py-2">שם</th>
                  <th className="text-right px-3 py-2">קטגוריה</th>
                  <th className="px-3 py-2 w-32" />
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => (
                  <tr key={r.id} className="border-t border-border">
                    <td className="px-3 py-2 font-bold text-foreground">{r.nameHebrew}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {CATEGORY_EMOJI[r.category]} {categoryLabels[r.category]}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1 justify-end">
                        <button
                          onClick={() => { setOpenedFromCard(false); setEditing({ ...r }); }}
                          className="p-2 rounded-md hover:bg-card text-foreground hover:text-neon"
                          aria-label="ערוך"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={async () => {
                            const ok = await confirmDelete({ title: "מחיקת מתכון", itemName: r.nameHebrew });
                            if (ok) void softDeleteRecipe(r.id);
                          }}
                          className="p-2 rounded-md hover:bg-card text-foreground hover:text-destructive"
                          aria-label="מחק"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {visible.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-3 py-8 text-center text-muted-foreground">
                      לא נמצאו מתכונים.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {editing && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur flex items-center justify-center p-4"
          onClick={closeEditor}
        >
          <div
            dir="rtl"
            className="bg-card border border-border rounded-lg w-full max-w-lg p-5 space-y-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-bold">
                {recipes.some((r) => r.id === editing.id) ? "עריכת מתכון" : "מתכון חדש"}
              </h2>
              <div className="flex items-center gap-1">
                {recipes.some((r) => r.id === editing.id) && (
                  <button
                    onClick={() => setShowHistory((v) => !v)}
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-bold transition ${
                      showHistory
                        ? "bg-neon/10 text-neon"
                        : "text-muted-foreground hover:text-neon"
                    }`}
                    aria-label="היסטוריית גרסאות"
                  >
                    <History className="h-4 w-4" />
                    היסטוריה
                  </button>
                )}
                <button
                  onClick={closeEditor}
                  className="p-1 text-muted-foreground hover:text-foreground"
                  aria-label="סגור"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {showHistory && recipes.some((r) => r.id === editing.id) && (
              <VersionHistory
                recipeId={editing.id}
                onRestore={(snap) => {
                  setEditing(snap);
                  setShowHistory(false);
                }}
              />
            )}

            <label className="block text-right">
              <span className="text-xs font-bold text-muted-foreground">שם המתכון</span>
              <input
                value={editing.nameHebrew}
                onChange={(e) => setEditing({ ...editing, nameHebrew: e.target.value })}
                className="mt-1 w-full bg-input border border-border rounded-md px-3 py-2 text-right"
              />
            </label>

            <label className="block text-right">
              <span className="text-xs font-bold text-muted-foreground">קטגוריה</span>
              <select
                value={editing.category}
                onChange={(e) =>
                  setEditing({ ...editing, category: e.target.value as RecipeCategory })
                }
                className="mt-1 w-full bg-input border border-border rounded-md px-3 py-2 text-right"
              >
                {categoryOrder.map((c) => (
                  <option key={c} value={c}>
                    {categoryLabels[c]}
                  </option>
                ))}
              </select>
            </label>

            <div className="text-right">
              <div className="flex items-center justify-between mb-2">
                <button
                  type="button"
                  onClick={() =>
                    setEditing({
                      ...editing,
                      ingredients: [
                        ...editing.ingredients,
                        { name: "", quantity: 0, unit: "גרם" },
                      ],
                    })
                  }
                  className="inline-flex items-center gap-1 text-xs font-bold text-neon hover:text-glow-neon"
                >
                  <Plus className="h-3 w-3" /> הוסף מרכיב
                </button>
                <span className="text-xs font-bold text-muted-foreground">
                  רשימת מרכיבים
                </span>
              </div>
              <ul className="space-y-2">
                {editing.ingredients.length === 0 && (
                  <li className="text-xs text-muted-foreground text-center py-2 border border-dashed border-border rounded-md">
                    אין מרכיבים. לחץ "הוסף מרכיב" כדי להתחיל.
                  </li>
                )}
                <SortableList
                  items={editing.ingredients.map((ing, i) => ({ ing, key: `${i}-${ing.name}` }))}
                  getId={(it) => it.key}
                  onReorder={(next) =>
                    setEditing({ ...editing, ingredients: next.map((x) => x.ing) })
                  }
                  className="space-y-2"
                >
                  {({ ing }, handle) => {
                    const idx = editing.ingredients.indexOf(ing);
                    return (
                      <li className="flex items-center gap-2">
                        {handle}
                        <button
                          type="button"
                          onClick={() =>
                            setEditing({
                              ...editing,
                              ingredients: editing.ingredients.filter((_, i) => i !== idx),
                            })
                          }
                          className="p-1.5 rounded-md text-muted-foreground hover:text-destructive"
                          aria-label="מחק מרכיב"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                        <select
                          value={ing.unit}
                          onChange={(e) => {
                            const next: Ingredient[] = [...editing.ingredients];
                            next[idx] = { ...ing, unit: e.target.value };
                            setEditing({ ...editing, ingredients: next });
                          }}
                          className="w-16 shrink-0 bg-input border border-border rounded-md px-1 py-1.5 text-xs text-right"
                        >
                          {UNIT_OPTIONS.map((u) => (
                            <option key={u} value={u}>
                              {u}
                            </option>
                          ))}
                        </select>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={ing.quantity === 0 ? "" : String(ing.quantity)}
                          onChange={(e) => {
                            const raw = e.target.value;
                            const next: Ingredient[] = [...editing.ingredients];
                            const n = raw === "" ? 0 : Number(raw);
                            next[idx] = {
                              ...ing,
                              quantity: Number.isFinite(n) ? n : 0,
                            };
                            setEditing({ ...editing, ingredients: next });
                          }}
                          placeholder="כמות"
                          size={4}
                          className="min-w-[3rem] max-w-[6rem] shrink-0 bg-input border border-border rounded-md px-2 py-1.5 text-center text-neon font-bold tabular-nums [field-sizing:content]"
                        />
                        <input
                          type="text"
                          value={ing.name}
                          onChange={(e) => {
                            const next: Ingredient[] = [...editing.ingredients];
                            next[idx] = { ...ing, name: e.target.value };
                            setEditing({ ...editing, ingredients: next });
                          }}
                          placeholder="שם המרכיב"
                          className="flex-1 min-w-0 bg-input border border-border rounded-md px-2 py-1.5 text-right"
                        />
                      </li>
                    );
                  }}
                </SortableList>
              </ul>

            </div>

            <label className="block text-right">
              <span className="text-xs font-bold text-muted-foreground">הוראות הכנה</span>
              <textarea
                value={editing.instructionsHebrew}
                onChange={(e) => setEditing({ ...editing, instructionsHebrew: e.target.value })}
                rows={6}
                placeholder="שלב אחרי שלב, בהירות מעל הכל"
                className="mt-1 w-full bg-input border border-border rounded-md px-3 py-2 text-right"
              />
            </label>

            <label className="block text-right">
              <span className="text-xs font-bold text-muted-foreground">
                חיי מדף (תוקף במקרר/הקפאה)
              </span>
              <input
                type="text"
                value={editing.shelfLifeHebrew ?? ""}
                onChange={(e) => setEditing({ ...editing, shelfLifeHebrew: e.target.value })}
                placeholder='לדוגמה: "3 ימים במקרר", "שבועיים", "חודש בהקפאה"'
                className="mt-1 w-full bg-input border border-border rounded-md px-3 py-2 text-right"
              />
              <span className="text-[10px] text-muted-foreground mt-1 block">
                אם משאירים ריק — יוצג: "תוקף: לפי נוהל מטבח כללי"
              </span>
            </label>

            {saveError && (
              <p className="text-xs text-destructive text-right">{saveError}</p>
            )}
            <div className="flex items-center justify-between gap-2 pt-2">
              {editing && !editing.id.startsWith("recipe-") ? (
                <ModalDeleteButton
                  title={`מחיקת מתכון "${editing.nameHebrew || "ללא שם"}"`}
                  description="האם למחוק פריט זה לצמיתות?"
                  onConfirm={async () => {
                    await softDeleteRecipe(editing.id);
                    toast.success("המתכון נמחק");
                    closeEditor();
                  }}
                />
              ) : (
                <span />
              )}
              <div className="flex items-center gap-2">
                <button
                  onClick={closeEditor}
                  className="h-11 px-4 rounded-md border border-border text-foreground hover:bg-card"
                >
                  ביטול
                </button>
                <button
                  onClick={save}
                  disabled={!editing.nameHebrew.trim() || saving}
                  className="h-11 inline-flex items-center gap-2 bg-neon text-primary-foreground font-bold px-4 rounded-md glow-neon disabled:opacity-50"
                >
                  <Check className="h-4 w-4" /> {saving ? "שומר..." : "שמור"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InvitationsPanel() {
  const { isSuperAdmin, email: myEmail } = useAuth();
  const [invites, setInvites] = useState<InvitationRow[]>([]);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [superAdminIds, setSuperAdminIds] = useState<Set<string>>(new Set());
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [fullNames, setFullNames] = useState<Map<string, string>>(new Map());
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<AppRole>("viewer");
  const [inviteBranch, setInviteBranch] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    const [{ data: i }, { data: r }, { data: s }, { data: b }, { data: p }] = await Promise.all([
      supabase
        .from("invitations")
        .select("id,email,role,created_at,assigned_branch_id,full_name")
        .order("created_at", { ascending: false }),
      supabase
        .from("user_roles")
        .select("id,email,role,user_id,assigned_branch_id")
        .order("created_at", { ascending: false }),
      supabase.rpc("list_super_admin_user_ids"),
      supabase.from("branches").select("id,name").eq("active", true).order("name"),
      supabase.rpc("list_user_profiles"),
    ]);
    setInvites((i ?? []) as InvitationRow[]);
    setRoles((r ?? []) as RoleRow[]);
    setSuperAdminIds(new Set(((s ?? []) as string[])));
    const branchList = (b ?? []) as BranchOption[];
    setBranches(branchList);
    // PART 4: auto-default branch on invite so no user is created without one
    setInviteBranch((prev) => prev || branchList[0]?.id || "");
    const m = new Map<string, string>();
    ((p ?? []) as { user_id: string; full_name: string | null }[]).forEach((row) => {
      if (row.full_name) m.set(row.user_id, row.full_name);
    });
    setFullNames(m);
  };

  useEffect(() => {
    load();
  }, []);

  // Force viewer if not super admin
  useEffect(() => {
    if (!isSuperAdmin && role === "admin") setRole("viewer");
  }, [isSuperAdmin, role]);

  const sendInvite = useServerFn(sendInvitationEmail);

  const invite = async () => {
    setError(null);
    const clean = email.trim().toLowerCase();
    if (!clean || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) {
      setError("כתובת אימייל לא תקינה");
      return;
    }
    if (role === "admin" && !isSuperAdmin) {
      setError("רק סופר-אדמין יכול להזמין מנהל חדש");
      return;
    }
    if (role === "viewer" && !inviteBranch) {
      setError("יש לבחור סניף עבור משתמש צפייה");
      return;
    }
    setBusy(true);
    const fallbackBranch = inviteBranch || branches[0]?.id || null;
    const { error: e } = await supabase
      .from("invitations")
      .upsert(
        { email: clean, role, assigned_branch_id: fallbackBranch, full_name: fullName.trim() || null },
        { onConflict: "email" },
      );
    if (e) {
      setBusy(false);
      setError(e.message);
      return;
    }
    try {
      await sendInvite({
        data: { to: clean, role, appUrl: window.location.origin },
      });
      toast.success(`הזמנה נשלחה ל-${clean}`);
    } catch (err) {
      toast.error(
        "ההזמנה נשמרה אך שליחת המייל נכשלה: " +
          (err instanceof Error ? err.message : "שגיאה"),
      );
    }
    setBusy(false);
    setEmail("");
    setFullName("");
    setInviteBranch("");
    await load();
  };

  const updateUserBranch = async (id: string, branchId: string | null) => {
    // Optimistic update so the dropdown + branch name re-render instantly
    setRoles((prev) =>
      prev.map((r) => (r.id === id ? { ...r, assigned_branch_id: branchId } : r)),
    );
    const { error: e } = await supabase
      .from("user_roles")
      .update({ assigned_branch_id: branchId })
      .eq("id", id);
    if (e) {
      toast.error(e.message);
      await load();
      return;
    }
    toast.success("השיוך עודכן");
  };

  const revokeInvite = async (id: string) => {
    const ok = await confirmDelete({ title: "ביטול הזמנה", description: "לבטל את ההזמנה? המשתמש המוזמן לא יוכל להירשם עם הקישור הקודם.", confirmLabel: "בטל הזמנה" });
    if (!ok) return;
    const { error: e } = await supabase.from("invitations").delete().eq("id", id);
    if (e) { setError(e.message); return; }
    await load();
  };


  const revokeUser = async (id: string, userRole: AppRole, userId: string) => {
    if (userRole === "admin" && !isSuperAdmin) {
      setError("רק סופר-אדמין יכול להסיר מנהל");
      return;
    }
    if (superAdminIds.has(userId)) {
      setError("לא ניתן להסיר סופר-אדמין");
      return;
    }
    const ok = await confirmDelete({ title: "הסרת משתמש", description: "להסיר את הרשאת המשתמש? לא יוכל יותר להיכנס למערכת.", confirmLabel: "הסר משתמש" });
    if (!ok) return;
    const { error: e } = await supabase.from("user_roles").delete().eq("id", id);
    if (e) { setError(e.message); return; }
    await load();
  };

  return (
    <section className="border border-border rounded-md p-5 bg-card/40">
      <div className="flex items-center justify-between gap-3 mb-4">
        <UserPlus className="h-5 w-5 text-neon shrink-0" />
        <div className="flex-1 text-right min-w-0">
          <div className="flex items-center justify-end gap-2 flex-wrap">
            {isSuperAdmin && (
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-neon text-primary-foreground whitespace-nowrap">
                Super Admin
              </span>
            )}
            <h2 className="font-display text-xl font-bold leading-none">
              ניהול <span className="text-neon text-glow-neon">הרשאות</span>
            </h2>
          </div>
          {myEmail && (
            <p className="text-[11px] text-muted-foreground mt-1 truncate" dir="ltr">
              {myEmail}
            </p>
          )}
        </div>
      </div>

      {!isSuperAdmin && (
        <p className="text-[11px] text-muted-foreground text-right mb-3">
          ניתן להזמין משתמשי "צפייה בלבד". הזמנת מנהלים חדשים שמורה לסופר-אדמין.
        </p>
      )}

      <div className="flex flex-col sm:flex-row-reverse gap-2 mb-4">
        <input
          type="text"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="שם מלא"
          className="flex-1 bg-input border border-border rounded-md px-3 py-2 text-right"
        />
        <input
          type="email"
          dir="ltr"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="email@example.com"
          className="flex-1 bg-input border border-border rounded-md px-3 py-2 text-left"
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as AppRole)}
          className="bg-input border border-border rounded-md px-3 py-2 text-right"
        >
          <option value="viewer">צפייה בלבד</option>
          {isSuperAdmin && <option value="admin">ניהול</option>}
        </select>
        <select
          value={inviteBranch}
          onChange={(e) => setInviteBranch(e.target.value)}
          className="bg-input border border-border rounded-md px-3 py-2 text-right"
        >
          <option value="">— בחר סניף —</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
        <button
          onClick={invite}
          disabled={busy}
          className="inline-flex items-center justify-center gap-2 bg-neon text-primary-foreground font-bold px-4 py-2 rounded-md glow-neon disabled:opacity-50"
        >
          <UserPlus className="h-4 w-4" /> הזמן
        </button>
      </div>
      {error && <p className="text-xs text-destructive text-right mb-3">{error}</p>}

      <div className="space-y-5">
        <div>
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider text-right mb-2">
            משתמשים פעילים
          </h3>
          <ul className="border border-border rounded-md divide-y divide-border">
            {roles.length === 0 && (
              <li className="px-3 py-3 text-center text-xs text-muted-foreground">
                אין משתמשים פעילים עדיין.
              </li>
            )}
            {roles.filter((u) => (u.role as string) !== "super_admin").map((u) => (
              <li
                key={u.id}
                className="flex items-center justify-between px-3 py-2 gap-2"
              >
                <button
                  onClick={() => revokeUser(u.id, u.role, u.user_id)}
                  disabled={superAdminIds.has(u.user_id) || (u.role === "admin" && !isSuperAdmin)}
                  className="p-2 rounded-md hover:bg-background text-muted-foreground hover:text-destructive disabled:opacity-30 disabled:cursor-not-allowed"
                  aria-label="הסר הרשאה"
                  title={superAdminIds.has(u.user_id) ? "לא ניתן להסיר סופר-אדמין" : ""}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
                <div className="text-right flex-1 min-w-0 flex flex-col items-end gap-1">
                  {fullNames.get(u.user_id) && (
                    <div className="text-sm font-bold truncate w-full text-right">
                      {fullNames.get(u.user_id)}
                    </div>
                  )}
                  <div className="text-[11px] text-muted-foreground truncate w-full text-right" dir="ltr">
                    {u.email}
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap justify-end">
                    {superAdminIds.has(u.user_id) && (
                      <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-neon/15 text-neon border border-neon/40 whitespace-nowrap">
                        Super
                      </span>
                    )}
                    <span className="text-[10px] text-neon font-bold whitespace-nowrap">
                      {u.role === "admin" ? "ניהול" : "צפייה בלבד"}
                    </span>
                    {u.assigned_branch_id && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-success/15 text-success border border-success/40 whitespace-nowrap">
                        🏢 {branches.find((b) => b.id === u.assigned_branch_id)?.name ?? "—"}
                      </span>
                    )}
                  </div>
                  {isSuperAdmin && !superAdminIds.has(u.user_id) && (
                    <select
                      value={u.assigned_branch_id ?? ""}
                      onChange={(e) => updateUserBranch(u.id, e.target.value || null)}
                      className="bg-input border border-border rounded-md px-2 py-1 text-[11px] text-right mt-1"
                    >
                      <option value="">— ללא סניף —</option>
                      {branches.map((b) => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider text-right mb-2">
            הזמנות בהמתנה
          </h3>
          <ul className="border border-border rounded-md divide-y divide-border">
            {invites.length === 0 && (
              <li className="px-3 py-3 text-center text-xs text-muted-foreground">
                אין הזמנות בהמתנה.
              </li>
            )}
            {invites.map((inv) => (
              <li
                key={inv.id}
                className="flex items-center justify-between px-3 py-2 gap-2"
              >
                <button
                  onClick={() => revokeInvite(inv.id)}
                  className="p-2 rounded-md hover:bg-background text-muted-foreground hover:text-destructive"
                  aria-label="בטל הזמנה"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
                <div className="text-right flex-1 min-w-0">
                  {inv.full_name && (
                    <div className="text-sm font-bold truncate text-right">
                      {inv.full_name}
                    </div>
                  )}
                  <div className="text-[11px] text-muted-foreground truncate" dir="ltr">
                    {inv.email}
                  </div>
                  <div className="text-[10px] text-neon font-bold">
                    {inv.role === "admin" ? "ניהול" : "צפייה בלבד"}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

interface VersionRow {
  id: string;
  changed_at: string;
  snapshot: Record<string, unknown>;
}

function snapshotToRecipe(snap: Record<string, unknown>): Recipe {
  return {
    id: String(snap.id ?? ""),
    category: (snap.category as RecipeCategory) ?? "sauces_bases",
    nameHebrew: String(snap.name_hebrew ?? ""),
    baseYieldHebrew: String(snap.base_yield_hebrew ?? ""),
    essenceHebrew: (snap.essence_hebrew as string | null) ?? undefined,
    ingredients: Array.isArray(snap.ingredients) ? (snap.ingredients as Ingredient[]) : [],
    spiceBag: (snap.spice_bag as SpiceBag | null) ?? undefined,
    instructionsHebrew: String(snap.instructions_hebrew ?? ""),
    timerSeconds: (snap.timer_seconds as number | null) ?? undefined,
    textureTargetHebrew: (snap.texture_target_hebrew as string | null) ?? undefined,
    techniqueNotesHebrew: (snap.technique_notes_hebrew as string | null) ?? undefined,
    shelfLifeHebrew: (snap.shelf_life_hebrew as string | null) ?? undefined,
    deleted: Boolean(snap.deleted),
  };
}

function formatRelative(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "ממש עכשיו";
  if (m < 60) return `לפני ${m} דק׳`;
  const h = Math.floor(m / 60);
  if (h < 24) return `לפני ${h} שע׳`;
  const days = Math.floor(h / 24);
  if (days < 7) return `לפני ${days} ימים`;
  return d.toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

function VersionHistory({
  recipeId,
  onRestore,
}: {
  recipeId: string;
  onRestore: (snapshot: Recipe) => void;
}) {
  const [versions, setVersions] = useState<VersionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    supabase
      .from("recipe_versions")
      .select("id,changed_at,snapshot")
      .eq("recipe_id", recipeId)
      .order("changed_at", { ascending: false })
      .limit(30)
      .then(({ data, error: e }) => {
        if (cancelled) return;
        if (e) setError(e.message);
        else setVersions((data ?? []) as VersionRow[]);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [recipeId]);

  return (
    <div className="border border-border rounded-md bg-background/40 p-3 text-right">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] text-muted-foreground">
          {versions.length} גרסאות אחרונות
        </span>
        <span className="text-xs font-bold text-neon">היסטוריית גרסאות</span>
      </div>
      {loading && (
        <p className="text-xs text-muted-foreground text-center py-3">טוען…</p>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
      {!loading && !error && versions.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-3">
          אין גרסאות קודמות. שינויים עתידיים יישמרו אוטומטית.
        </p>
      )}
      <ul className="space-y-1.5 max-h-56 overflow-y-auto">
        {versions.map((v) => {
          const snap = snapshotToRecipe(v.snapshot);
          const isOpen = expanded === v.id;
          return (
            <li
              key={v.id}
              className="border border-border/60 rounded-md bg-card/40"
            >
              <div className="flex items-center justify-between gap-2 px-2 py-1.5">
                <button
                  onClick={() => onRestore(snap)}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-neon hover:text-glow-neon"
                  title="שחזר גרסה זו לטופס"
                >
                  <RotateCcw className="h-3 w-3" />
                  שחזר
                </button>
                <button
                  onClick={() => setExpanded(isOpen ? null : v.id)}
                  className="flex-1 text-right text-xs"
                >
                  <span className="font-bold text-foreground truncate block">
                    {snap.nameHebrew || "—"}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {formatRelative(v.changed_at)}
                  </span>
                </button>
              </div>
              {isOpen && (
                <div className="px-3 pb-2 text-[11px] text-muted-foreground space-y-1 border-t border-border/40 pt-2">
                  {snap.essenceHebrew && (
                    <p className="line-clamp-2">{snap.essenceHebrew}</p>
                  )}
                  <p>
                    <span className="text-foreground font-bold">מרכיבים: </span>
                    {snap.ingredients.length}
                  </p>
                  {snap.instructionsHebrew && (
                    <p className="line-clamp-3 whitespace-pre-wrap">
                      {snap.instructionsHebrew}
                    </p>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Admin sub-components: tabs, supplier reminders, CMS texts
// ---------------------------------------------------------------------------

function TabButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative inline-flex items-center gap-2 px-3 sm:px-4 py-2.5 text-sm font-bold whitespace-nowrap transition-colors ${
        active
          ? "text-neon"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {icon}
      {children}
      {active && (
        <span className="absolute right-0 left-0 -bottom-px h-0.5 bg-neon shadow-[0_0_8px_var(--neon)]" />
      )}
    </button>
  );
}

function SupplierRemindersPanel() {
  const { settings, setLocal, save, loading } = useSupplierReminderSettings();
  const [users, setUsers] = useState<{ user_id: string; email: string; role: string }[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void supabase
      .from("user_roles")
      .select("user_id,email,role")
      .order("email")
      .then(({ data }) => setUsers((data ?? []) as never));
  }, []);

  const toggleRecipient = (id: string) => {
    const next = settings.recipients.includes(id)
      ? settings.recipients.filter((r) => r !== id)
      : [...settings.recipients, id];
    setLocal({ ...settings, recipients: next });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await save(settings);
      toast.success("הגדרות התזכורות נשמרו");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "שמירה נכשלה");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="text-center text-muted-foreground py-8 text-sm">טוען…</p>;
  }

  return (
    <section className="border border-border rounded-md p-5 bg-card/40 space-y-6" dir="rtl">
      <div className="flex items-center gap-2">
        <Bell className="h-5 w-5 text-neon" />
        <h2 className="font-display text-xl font-bold">
          תזכורות <span className="text-neon text-glow-neon">ספקים</span>
        </h2>
      </div>
      <p className="text-xs text-muted-foreground -mt-3">
        קבעו מתי תישלח התזכורת ולמי, לפני הגעת ספקים.
      </p>

      <div>
        <label className="block text-xs font-bold text-muted-foreground mb-2 text-right">
          מתי לשלוח תזכורת
        </label>
        <select
          value={settings.timing}
          onChange={(e) =>
            setLocal({
              ...settings,
              timing: e.target.value as SupplierReminderSettings["timing"],
            })
          }
          className="w-full bg-input border border-border rounded-md px-3 py-2 text-right text-sm"
        >
          <option value="evening_before">ערב לפני ההגעה (20:00)</option>
          <option value="morning_of">בבוקר ההגעה (07:00)</option>
          <option value="both">גם ערב לפני וגם בבוקר</option>
        </select>
      </div>

      <div>
        <label className="block text-xs font-bold text-muted-foreground mb-2 text-right">
          למי לשלוח ({settings.recipients.length} נבחרו)
        </label>
        <ul className="border border-border rounded-md divide-y divide-border max-h-72 overflow-y-auto">
          {users.length === 0 && (
            <li className="px-3 py-3 text-center text-xs text-muted-foreground">
              אין משתמשים פעילים.
            </li>
          )}
          {users.map((u) => {
            const checked = settings.recipients.includes(u.user_id);
            return (
              <li key={u.user_id} className="flex items-center justify-between px-3 py-2 gap-2">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleRecipient(u.user_id)}
                  className="h-4 w-4 accent-[var(--neon)] shrink-0"
                />
                <div className="flex-1 text-right min-w-0">
                  <div className="text-sm font-bold truncate" dir="ltr">{u.email}</div>
                  <div className="text-[10px] text-neon font-bold">
                    {u.role === "admin" ? "ניהול" : "צפייה בלבד"}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 bg-neon text-primary-foreground font-bold px-4 py-2 rounded-md glow-neon disabled:opacity-50"
        >
          <Save className="h-4 w-4" /> {saving ? "שומר…" : "שמור הגדרות"}
        </button>
      </div>
    </section>
  );
}

const GROUP_LABELS: Record<string, string> = {
  home: "📊 דף הבית",
  notebook: "📋 פנקס יומי",
  general: "🏷️ כותרות כלליות",
};

function ContentTextsPanel() {
  const all = useSiteTextsStore((s) => s.all);
  const loaded = useSiteTextsStore((s) => s.loaded);
  const load = useSiteTextsStore((s) => s.load);
  const update = useSiteTextsStore((s) => s.update);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);

  useEffect(() => {
    if (!loaded) void load();
  }, [loaded, load]);

  const grouped = useMemo(() => {
    const map: Record<string, typeof all> = {};
    all.forEach((t) => {
      (map[t.group_key] ??= []).push(t);
    });
    return map;
  }, [all]);

  const handleSave = async (key: string) => {
    const value = drafts[key];
    if (value === undefined) return;
    setSavingKey(key);
    try {
      await update(key, value);
      setDrafts((d) => {
        const next = { ...d };
        delete next[key];
        return next;
      });
      toast.success("הטקסט עודכן");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "שמירה נכשלה");
    } finally {
      setSavingKey(null);
    }
  };

  if (!loaded) {
    return <p className="text-center text-muted-foreground py-8 text-sm">טוען…</p>;
  }

  return (
    <section className="space-y-6" dir="rtl">
      <div className="flex items-center gap-2">
        <FileText className="h-5 w-5 text-neon" />
        <h2 className="font-display text-xl font-bold">
          ניהול <span className="text-neon text-glow-neon">תוכן וטקסטים</span>
        </h2>
      </div>
      <p className="text-xs text-muted-foreground -mt-3">
        ערכו את כל הטקסטים הדינמיים של האתר. השינויים נשמרים ומשתקפים בכל המכשירים בזמן אמת.
      </p>

      {Object.entries(grouped).map(([group, items]) => (
        <div key={group} className="border border-border rounded-md p-4 bg-card/40">
          <h3 className="font-display text-sm font-bold mb-3 text-neon">
            {GROUP_LABELS[group] ?? group}
          </h3>
          <ul className="space-y-3">
            {items.map((t) => {
              const draft = drafts[t.key];
              const current = draft ?? t.value;
              const dirty = draft !== undefined && draft !== t.value;
              const isLong = current.length > 60 || current.includes("\n");
              return (
                <li key={t.key} className="space-y-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[10px] text-muted-foreground font-mono" dir="ltr">
                      {t.key}
                    </span>
                    <label className="text-xs font-bold text-foreground/80">
                      {t.label}
                    </label>
                  </div>
                  {isLong ? (
                    <textarea
                      value={current}
                      onChange={(e) =>
                        setDrafts((d) => ({ ...d, [t.key]: e.target.value }))
                      }
                      rows={3}
                      className="w-full bg-input border border-border rounded-md px-3 py-2 text-right text-sm"
                    />
                  ) : (
                    <input
                      type="text"
                      value={current}
                      onChange={(e) =>
                        setDrafts((d) => ({ ...d, [t.key]: e.target.value }))
                      }
                      className="w-full bg-input border border-border rounded-md px-3 py-2 text-right text-sm"
                    />
                  )}
                  {dirty && (
                    <div className="flex justify-end">
                      <button
                        onClick={() => handleSave(t.key)}
                        disabled={savingKey === t.key}
                        className="inline-flex items-center gap-1 text-xs font-bold text-neon hover:text-glow-neon disabled:opacity-50"
                      >
                        <Save className="h-3 w-3" />
                        {savingKey === t.key ? "שומר…" : "שמור"}
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </section>
  );
}

// ============================================================
// Super Admin Users Panel — full CRUD/Lifecycle directory
// ============================================================

type DirectoryStatus = "invited" | "active" | "suspended";

interface DirectoryRow {
  kind: "user" | "invite";
  row_id: string;
  user_id: string | null;
  email: string;
  full_name: string | null;
  role: AppRole;
  assigned_branch_id: string | null;
  is_active: boolean;
  status: DirectoryStatus;
  created_at: string;
}

interface EditState {
  row: DirectoryRow;
  fullName: string;
  email: string;
  role: AppRole;
  branchId: string;
  dateOfBirth: string;
  startDate: string;
}

interface ConfirmState {
  title: string;
  body: string;
  confirmLabel: string;
  destructive?: boolean;
  onConfirm: () => Promise<void> | void;
}

function StatusBadge({ status }: { status: DirectoryStatus }) {
  const map: Record<DirectoryStatus, { label: string; cls: string }> = {
    invited: {
      label: "הזמנה ממתינה",
      cls: "bg-amber-500/15 text-amber-400 border-amber-500/40",
    },
    active: {
      label: "פעיל",
      cls: "bg-success/15 text-success border-success/40",
    },
    suspended: {
      label: "מושבת",
      cls: "bg-destructive/15 text-destructive border-destructive/40",
    },
  };
  const m = map[status];
  return (
    <span
      className={`text-[10px] font-bold px-2 py-0.5 rounded border ${m.cls} whitespace-nowrap`}
    >
      {m.label}
    </span>
  );
}

function SuperAdminUsersPanel() {
  const [rows, setRows] = useState<DirectoryRow[]>([]);
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [superAdminIds, setSuperAdminIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | DirectoryStatus>("all");
  const [editing, setEditing] = useState<EditState | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [working, setWorking] = useState(false);

  const updateUserFn = useServerFn(adminUpdateUser);
  const suspendFn = useServerFn(adminSuspendUser);
  const reactivateFn = useServerFn(adminReactivateUser);
  const revokeInviteFn = useServerFn(adminRevokeInvitation);
  const updateInviteFn = useServerFn(adminUpdateInvitation);
  const sendInvite = useServerFn(sendInvitationEmail);

  const load = async () => {
    setLoading(true);
    const [{ data: dir }, { data: b }, { data: s }] = await Promise.all([
      supabase.rpc("list_user_directory"),
      supabase.from("branches").select("id,name").eq("active", true).order("name"),
      supabase.rpc("list_super_admin_user_ids"),
    ]);
    setRows(((dir ?? []) as DirectoryRow[]).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    ));
    setBranches((b ?? []) as BranchOption[]);
    setSuperAdminIds(new Set(((s ?? []) as string[])));
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const branchName = (id: string | null) =>
    id ? branches.find((b) => b.id === id)?.name ?? "—" : "—";

  const visibleRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (!q) return true;
      return (
        r.email.toLowerCase().includes(q) ||
        (r.full_name ?? "").toLowerCase().includes(q)
      );
    });
  }, [rows, query, statusFilter]);

  const openEdit = async (row: DirectoryRow) => {
    let dob = "";
    let sd = "";
    if (row.kind === "user" && row.user_id) {
      const { data } = await supabase
        .from("profiles")
        .select("date_of_birth,start_date")
        .eq("user_id", row.user_id)
        .maybeSingle();
      dob = (data?.date_of_birth as string | null) ?? "";
      sd = (data?.start_date as string | null) ?? "";
    }
    setEditing({
      row,
      fullName: row.full_name ?? "",
      email: row.email,
      role: row.role,
      branchId: row.assigned_branch_id ?? "",
      dateOfBirth: dob,
      startDate: sd,
    });
  };

  const saveEdit = async () => {
    if (!editing) return;
    const e = editing;
    const cleanEmail = e.email.trim().toLowerCase();
    const cleanName = e.fullName.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      toast.error("כתובת אימייל לא תקינה");
      return;
    }
    if (cleanName.length === 0) {
      toast.error("שם מלא הוא שדה חובה");
      return;
    }
    setWorking(true);
    try {
      if (e.row.kind === "invite") {
        await updateInviteFn({
          data: {
            invitationId: e.row.row_id,
            fullName: cleanName,
            email: cleanEmail,
            role: e.role,
            assignedBranchId: e.branchId || null,
          },
        });
      } else {
        await updateUserFn({
          data: {
            roleId: e.row.row_id,
            userId: e.row.user_id!,
            fullName: cleanName,
            email: cleanEmail,
            role: e.role,
            assignedBranchId: e.branchId || null,
            dateOfBirth: e.dateOfBirth || null,
            startDate: e.startDate || null,
          },
        });
      }
      toast.success("הפרטים עודכנו");
      setEditing(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "שגיאה בעדכון");
    } finally {
      setWorking(false);
    }
  };

  const runConfirm = (state: ConfirmState) => setConfirm(state);

  const handleSuspend = (row: DirectoryRow) => {
    runConfirm({
      title: "השבתת חשבון",
      body: `האם אתה בטוח שברצונך להשבית את ${row.full_name ?? row.email}? הגישה תיחסם מיידית בכל המכשירים. הנתונים ההיסטוריים יישמרו.`,
      confirmLabel: "השבת חשבון",
      destructive: true,
      onConfirm: async () => {
        await suspendFn({
          data: { roleId: row.row_id, userId: row.user_id! },
        });
        toast.success("החשבון הושבת והגישה נחסמה");
        await load();
      },
    });
  };

  const handleReactivate = (row: DirectoryRow) => {
    runConfirm({
      title: "הפעלה מחדש",
      body: `להחזיר את ${row.full_name ?? row.email} למצב פעיל?`,
      confirmLabel: "הפעל",
      onConfirm: async () => {
        await reactivateFn({ data: { roleId: row.row_id } });
        toast.success("החשבון הופעל מחדש");
        await load();
      },
    });
  };

  const handleRevokeInvite = (row: DirectoryRow) => {
    runConfirm({
      title: "ביטול הזמנה",
      body: `לבטל את ההזמנה של ${row.email}? קישור ההרשמה יפסיק לפעול.`,
      confirmLabel: "בטל הזמנה",
      destructive: true,
      onConfirm: async () => {
        await revokeInviteFn({ data: { invitationId: row.row_id } });
        toast.success("ההזמנה בוטלה בהצלחה");
        await load();
      },
    });
  };

  const handleResendInvite = async (row: DirectoryRow) => {
    try {
      await sendInvite({
        data: {
          to: row.email,
          role: row.role,
          appUrl: window.location.origin,
        },
      });
      toast.success(`ההזמנה נשלחה מחדש ל-${row.email}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "שליחה נכשלה");
    }
  };

  const confirmConfirm = async () => {
    if (!confirm) return;
    setWorking(true);
    try {
      await confirm.onConfirm();
      setConfirm(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "שגיאה");
    } finally {
      setWorking(false);
    }
  };

  return (
    <section className="border border-border rounded-md p-5 bg-card/40">
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-neon text-primary-foreground">
            Super Admin
          </span>
          <h2 className="font-display text-xl font-bold">
            ניהול <span className="text-neon text-glow-neon">משתמשים מלא</span>
          </h2>
        </div>
        <span className="text-[11px] text-muted-foreground">
          {visibleRows.length} / {rows.length}
        </span>
      </div>

      <div className="flex flex-col sm:flex-row-reverse gap-2 mb-4">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="חיפוש שם או מייל…"
          className="flex-1 bg-input border border-border rounded-md px-3 py-2 text-right"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
          className="bg-input border border-border rounded-md px-3 py-2 text-right"
        >
          <option value="all">כל הסטטוסים</option>
          <option value="active">פעיל</option>
          <option value="invited">הזמנה ממתינה</option>
          <option value="suspended">מושבת</option>
        </select>
      </div>

      {loading ? (
        <p className="text-center text-xs text-muted-foreground py-8">טוען…</p>
      ) : visibleRows.length === 0 ? (
        <p className="text-center text-xs text-muted-foreground py-8">
          לא נמצאו משתמשים
        </p>
      ) : (
        <ul className="border border-border rounded-md divide-y divide-border">
          {visibleRows.map((row) => {
            const isSuper = row.user_id ? superAdminIds.has(row.user_id) : false;
            return (
              <li key={`${row.kind}-${row.row_id}`} className="p-3 space-y-2">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="text-right flex-1 min-w-0">
                    <div className="flex items-center gap-2 justify-end flex-wrap">
                      <StatusBadge status={row.status} />
                      {isSuper && (
                        <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-neon/15 text-neon border border-neon/40">
                          Super
                        </span>
                      )}
                      <span className="text-sm font-bold truncate">
                        {row.full_name ?? "—"}
                      </span>
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-1" dir="ltr">
                      {row.email}
                    </div>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap justify-end text-[10px]">
                      <span className="text-neon font-bold">
                        {row.role === "admin" ? "מנהל" : "צפייה בלבד"}
                      </span>
                      <span className="text-muted-foreground">·</span>
                      <span className="text-foreground">
                        🏢 {branchName(row.assigned_branch_id)}
                      </span>
                      <span className="text-muted-foreground">·</span>
                      <span className="text-muted-foreground">
                        נוסף {formatRelative(row.created_at)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap justify-end">
                  <button
                    onClick={() => openEdit(row)}
                    className="text-[11px] px-2.5 py-1 rounded-md border border-border bg-input hover:bg-card text-foreground inline-flex items-center gap-1"
                    title="ערוך פרטים"
                  >
                    <Pencil className="h-3 w-3" /> ערוך
                  </button>


                  {row.kind === "invite" && (
                    <>
                      <button
                        onClick={() => handleResendInvite(row)}
                        className="text-[11px] px-2.5 py-1 rounded-md border border-neon/40 bg-neon/10 hover:bg-neon/20 text-neon inline-flex items-center gap-1"
                      >
                        <Bell className="h-3 w-3" /> שלח שוב
                      </button>
                      <button
                        onClick={() => handleRevokeInvite(row)}
                        className="text-[11px] px-2.5 py-1 rounded-md border border-destructive/40 bg-destructive/10 hover:bg-destructive/20 text-destructive inline-flex items-center gap-1"
                      >
                        <Trash2 className="h-3 w-3" /> בטל הזמנה
                      </button>
                    </>
                  )}

                  {row.kind === "user" && row.status === "active" && !isSuper && (
                    <button
                      onClick={() => handleSuspend(row)}
                      className="text-[11px] px-2.5 py-1 rounded-md border border-destructive/40 bg-destructive/10 hover:bg-destructive/20 text-destructive inline-flex items-center gap-1"
                    >
                      <ShieldAlert className="h-3 w-3" /> השבת
                    </button>
                  )}

                  {row.kind === "user" && row.status === "suspended" && (
                    <button
                      onClick={() => handleReactivate(row)}
                      className="text-[11px] px-2.5 py-1 rounded-md border border-success/40 bg-success/10 hover:bg-success/20 text-success inline-flex items-center gap-1"
                    >
                      <Check className="h-3 w-3" /> הפעל מחדש
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Edit Modal */}
      {editing && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-lg w-full max-w-md p-5 space-y-4 text-right">
            <div className="flex items-center justify-between">
              <button
                onClick={() => setEditing(null)}
                className="p-1 rounded-md hover:bg-background"
                aria-label="סגור"
              >
                <X className="h-4 w-4" />
              </button>
              <h3 className="font-display text-lg font-bold">עריכת משתמש</h3>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">שם מלא</label>
              <input
                type="text"
                value={editing.fullName}
                onChange={(e) =>
                  setEditing({ ...editing, fullName: e.target.value })
                }
                className="w-full bg-input border border-border rounded-md px-3 py-2 text-right"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">דוא״ל</label>
              <input
                type="email"
                dir="ltr"
                value={editing.email}
                onChange={(e) =>
                  setEditing({ ...editing, email: e.target.value })
                }
                className="w-full bg-input border border-border rounded-md px-3 py-2 text-left"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">תפקיד</label>
              <select
                value={editing.role}
                onChange={(e) =>
                  setEditing({ ...editing, role: e.target.value as AppRole })
                }
                className="w-full bg-input border border-border rounded-md px-3 py-2 text-right"
              >
                <option value="viewer">צפייה בלבד</option>
                <option value="employee">עובד</option>
                <option value="manager">מנהל משמרת</option>
                <option value="admin">מנהל</option>
                <option value="super_admin">סופר-אדמין</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">סניף משויך</label>
              <select
                value={editing.branchId}
                onChange={(e) =>
                  setEditing({ ...editing, branchId: e.target.value })
                }
                className="w-full bg-input border border-border rounded-md px-3 py-2 text-right"
              >
                <option value="">— ללא סניף —</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            {editing.row.kind === "user" && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">תאריך יום הולדת</label>
                  <input
                    type="date"
                    dir="ltr"
                    value={editing.dateOfBirth}
                    onChange={(e) =>
                      setEditing({ ...editing, dateOfBirth: e.target.value })
                    }
                    className="w-full bg-input border border-border rounded-md px-3 py-2 text-left"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">תאריך כניסה לפיצה</label>
                  <input
                    type="date"
                    dir="ltr"
                    value={editing.startDate}
                    onChange={(e) =>
                      setEditing({ ...editing, startDate: e.target.value })
                    }
                    className="w-full bg-input border border-border rounded-md px-3 py-2 text-left"
                  />
                </div>
              </div>
            )}


            <div className="flex items-center justify-between gap-2 pt-2">
              <ModalDeleteButton
                title={
                  editing.row.kind === "invite"
                    ? `ביטול הזמנה ל-${editing.email}`
                    : `הסרת משתמש ${editing.fullName || editing.email}`
                }
                description="האם למחוק פריט זה לצמיתות?"
                disabled={working}
                onConfirm={async () => {
                  try {
                    if (editing.row.kind === "invite") {
                      await revokeInviteFn({ data: { invitationId: editing.row.row_id } });
                      toast.success("ההזמנה בוטלה");
                    } else {
                      await suspendFn({
                        data: { roleId: editing.row.row_id, userId: editing.row.user_id! },
                      });
                      toast.success("המשתמש הוסר");
                    }
                    setEditing(null);
                    await load();
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "שגיאה במחיקה");
                    throw err;
                  }
                }}
              />
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setEditing(null)}
                  className="h-11 px-4 rounded-md border border-border text-foreground hover:bg-background"
                >
                  ביטול
                </button>
                <button
                  onClick={saveEdit}
                  disabled={working}
                  className="h-11 inline-flex items-center gap-2 bg-neon text-primary-foreground font-bold px-4 rounded-md glow-neon disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  {working ? "שומר…" : "שמור שינויים"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirm && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-lg w-full max-w-sm p-5 space-y-4 text-right">
            <h3 className="font-display text-lg font-bold">{confirm.title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {confirm.body}
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setConfirm(null)}
                disabled={working}
                className="px-4 py-2 rounded-md border border-border text-foreground hover:bg-background disabled:opacity-50"
              >
                ביטול
              </button>
              <button
                onClick={confirmConfirm}
                disabled={working}
                className={`px-4 py-2 rounded-md font-bold disabled:opacity-50 ${
                  confirm.destructive
                    ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    : "bg-neon text-primary-foreground glow-neon"
                }`}
              >
                {working ? "מעבד…" : confirm.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
