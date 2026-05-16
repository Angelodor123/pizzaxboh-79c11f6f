import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Trash2, Pencil, X, Check, UserPlus, ShieldAlert, History, RotateCcw } from "lucide-react";
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

export const Route = createFileRoute("/admin")({
  component: AdminGate,
  validateSearch: (search: Record<string, unknown>) => ({
    edit: typeof search.edit === "string" ? search.edit : undefined,
  }),
});

type AppRole = "admin" | "viewer";

interface InvitationRow {
  id: string;
  email: string;
  role: AppRole;
  created_at: string;
}

interface RoleRow {
  id: string;
  email: string;
  role: AppRole;
  user_id: string;
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

const CATEGORY_EMOJI: Record<RecipeCategory, string> = {
  sauces_bases: "🍅",
  aiolis_sauces: "🍯",
  jams_creams: "🥘",
  starters: "🌽",
  spices: "🧂",
  desserts: "🍪",
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
      setEditing(null);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "שמירה נכשלה");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <div className="mb-6">
        <div className="text-[10px] uppercase tracking-[0.3em] text-neon font-bold">
          Admin
        </div>
        <h1 className="font-display text-4xl font-bold mt-1">
          מערכת <span className="text-neon text-glow-neon">ניהול</span>
        </h1>
      </div>

      <section className="mb-10">
        <h2 className="font-display text-xl font-bold mb-3 text-right">
          ניהול הרשאות
        </h2>
        <InvitationsPanel />
      </section>

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
                        onClick={() => {
                          if (confirm(`למחוק את "${r.nameHebrew}"?`)) void softDeleteRecipe(r.id);
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

      {editing && (() => {
        const closeEditor = () => {
          setEditing(null);
          if (openedFromCard) {
            setOpenedFromCard(false);
            // Return the user to the page they were on when they pressed edit
            if (typeof window !== "undefined" && window.history.length > 1) {
              window.history.back();
            }
          }
        };
        return (
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
                {editing.ingredients.map((ing, idx) => (
                  <li key={idx} className="flex items-center gap-2">
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
                ))}
                {editing.ingredients.length === 0 && (
                  <li className="text-xs text-muted-foreground text-center py-2 border border-dashed border-border rounded-md">
                    אין מרכיבים. לחץ "הוסף מרכיב" כדי להתחיל.
                  </li>
                )}
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

            {saveError && (
              <p className="text-xs text-destructive text-right">{saveError}</p>
            )}
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setEditing(null)}
                className="px-4 py-2 rounded-md border border-border text-foreground hover:bg-card"
              >
                ביטול
              </button>
              <button
                onClick={save}
                disabled={!editing.nameHebrew.trim() || saving}
                className="inline-flex items-center gap-2 bg-neon text-primary-foreground font-bold px-4 py-2 rounded-md glow-neon disabled:opacity-50"
              >
                <Check className="h-4 w-4" /> {saving ? "שומר..." : "שמור"}
              </button>
            </div>
          </div>
        </div>
        );
      })()}
    </div>
  );
}

function InvitationsPanel() {
  const [invites, setInvites] = useState<InvitationRow[]>([]);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AppRole>("viewer");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    const [{ data: i }, { data: r }] = await Promise.all([
      supabase
        .from("invitations")
        .select("id,email,role,created_at")
        .order("created_at", { ascending: false }),
      supabase
        .from("user_roles")
        .select("id,email,role,user_id")
        .order("created_at", { ascending: false }),
    ]);
    setInvites((i ?? []) as InvitationRow[]);
    setRoles((r ?? []) as RoleRow[]);
  };

  useEffect(() => {
    load();
  }, []);

  const invite = async () => {
    setError(null);
    const clean = email.trim().toLowerCase();
    if (!clean || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) {
      setError("כתובת אימייל לא תקינה");
      return;
    }
    setBusy(true);
    const { error: e } = await supabase
      .from("invitations")
      .upsert({ email: clean, role }, { onConflict: "email" });
    setBusy(false);
    if (e) {
      setError(e.message);
      return;
    }
    setEmail("");
    await load();
  };

  const revokeInvite = async (id: string) => {
    if (!confirm("לבטל את ההזמנה?")) return;
    await supabase.from("invitations").delete().eq("id", id);
    await load();
  };

  const revokeUser = async (id: string) => {
    if (!confirm("להסיר את הרשאת המשתמש?")) return;
    await supabase.from("user_roles").delete().eq("id", id);
    await load();
  };

  return (
    <section className="mt-10 border border-border rounded-md p-5 bg-card/40">
      <div className="flex items-center justify-end gap-2 mb-4">
        <h2 className="font-display text-xl font-bold text-right flex-1">
          ניהול <span className="text-neon text-glow-neon">הרשאות</span>
        </h2>
        <UserPlus className="h-5 w-5 text-neon" />
      </div>

      <div className="flex flex-col sm:flex-row-reverse gap-2 mb-4">
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
          <option value="admin">ניהול</option>
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
            {roles.map((u) => (
              <li
                key={u.id}
                className="flex items-center justify-between px-3 py-2 gap-2"
              >
                <button
                  onClick={() => revokeUser(u.id)}
                  className="p-2 rounded-md hover:bg-background text-muted-foreground hover:text-destructive"
                  aria-label="הסר הרשאה"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
                <div className="text-right flex-1 min-w-0">
                  <div className="text-sm font-bold truncate" dir="ltr">
                    {u.email}
                  </div>
                  <div className="text-[10px] text-neon font-bold">
                    {u.role === "admin" ? "ניהול" : "צפייה בלבד"}
                  </div>
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
                  <div className="text-sm font-bold truncate" dir="ltr">
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
