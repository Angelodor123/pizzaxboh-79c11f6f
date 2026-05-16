import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Trash2, Pencil, X, Check, UserPlus, ShieldAlert } from "lucide-react";
import {
  categoryLabels,
  categoryOrder,
  type Recipe,
  type RecipeCategory,
} from "@/lib/cookbook";
import { useCookbookStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin")({
  component: AdminGate,
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
          עמוד זה זמין למשתמשים בעלי תפקיד "ניהול" בלבד.
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

const EMPTY: Recipe = {
  id: "",
  category: "sauces_bases",
  nameHebrew: "",
  baseYieldHebrew: "",
  ingredients: [],
  instructionsHebrew: "",
};

function AdminPage() {
  const recipes = useCookbookStore((s) => s.recipes);
  const addRecipe = useCookbookStore((s) => s.addRecipe);
  const updateRecipe = useCookbookStore((s) => s.updateRecipe);
  const softDeleteRecipe = useCookbookStore((s) => s.softDeleteRecipe);

  const [editing, setEditing] = useState<Recipe | null>(null);
  const [filter, setFilter] = useState<RecipeCategory | "all">("all");

  const visible = recipes
    .filter((r) => !r.deleted)
    .filter((r) => (filter === "all" ? true : r.category === filter));

  const startNew = () =>
    setEditing({ ...EMPTY, id: `recipe-${Date.now()}` });

  const save = () => {
    if (!editing) return;
    if (!editing.nameHebrew.trim()) return;
    const exists = recipes.some((r) => r.id === editing.id);
    if (exists) updateRecipe(editing.id, editing);
    else addRecipe(editing);
    setEditing(null);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <div className="mb-6 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="text-[10px] uppercase tracking-[0.3em] text-neon font-bold">
            Admin
          </div>
          <h1 className="font-display text-4xl font-bold mt-1">
            מערכת <span className="text-neon text-glow-neon">ניהול</span>
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">
            הוסף, ערוך ומחק מתכונים. השינויים נשמרים מקומית במכשיר.
          </p>
        </div>
        <button
          onClick={startNew}
          className="inline-flex items-center gap-2 bg-neon text-primary-foreground font-bold px-4 py-2 rounded-md glow-neon"
        >
          <Plus className="h-4 w-4" /> מתכון חדש
        </button>
      </div>

      <div className="flex gap-1.5 overflow-x-auto scrollbar-hide mb-4">
        {(["all", ...categoryOrder] as const).map((c) => (
          <button
            key={c}
            onClick={() => setFilter(c)}
            className={`shrink-0 px-3 py-2 rounded-md text-xs font-bold border whitespace-nowrap ${
              filter === c
                ? "bg-deep-green text-jungle-foreground border-deep-green"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {c === "all" ? "הכל" : categoryLabels[c]}
          </button>
        ))}
      </div>

      <div className="border border-border rounded-md overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-card text-muted-foreground text-xs uppercase tracking-wider">
            <tr>
              <th className="text-right px-3 py-2">שם</th>
              <th className="text-right px-3 py-2">קטגוריה</th>
              <th className="text-right px-3 py-2">תפוקה</th>
              <th className="px-3 py-2 w-32" />
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <tr key={r.id} className="border-t border-border">
                <td className="px-3 py-2 font-bold text-foreground">{r.nameHebrew}</td>
                <td className="px-3 py-2 text-muted-foreground">{categoryLabels[r.category]}</td>
                <td className="px-3 py-2 text-muted-foreground">{r.baseYieldHebrew}</td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1 justify-end">
                    <button
                      onClick={() => setEditing({ ...r })}
                      className="p-2 rounded-md hover:bg-card text-foreground hover:text-neon"
                      aria-label="ערוך"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`למחוק את "${r.nameHebrew}"?`)) softDeleteRecipe(r.id);
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
                <td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">
                  אין מתכונים בקטגוריה זו.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur flex items-center justify-center p-4"
          onClick={() => setEditing(null)}
        >
          <div
            className="bg-card border border-border rounded-lg w-full max-w-lg p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-bold">
                {recipes.some((r) => r.id === editing.id) ? "עריכת מתכון" : "מתכון חדש"}
              </h2>
              <button
                onClick={() => setEditing(null)}
                className="p-1 text-muted-foreground hover:text-foreground"
                aria-label="סגור"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

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

            <label className="block text-right">
              <span className="text-xs font-bold text-muted-foreground">תפוקת בסיס</span>
              <input
                value={editing.baseYieldHebrew}
                onChange={(e) => setEditing({ ...editing, baseYieldHebrew: e.target.value })}
                placeholder="לדוגמה: 2 בקבוקים של 5 ליטר"
                className="mt-1 w-full bg-input border border-border rounded-md px-3 py-2 text-right"
              />
            </label>

            <label className="block text-right">
              <span className="text-xs font-bold text-muted-foreground">הוראות הכנה</span>
              <textarea
                value={editing.instructionsHebrew}
                onChange={(e) => setEditing({ ...editing, instructionsHebrew: e.target.value })}
                rows={4}
                className="mt-1 w-full bg-input border border-border rounded-md px-3 py-2 text-right"
              />
            </label>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setEditing(null)}
                className="px-4 py-2 rounded-md border border-border text-foreground hover:bg-card"
              >
                ביטול
              </button>
              <button
                onClick={save}
                disabled={!editing.nameHebrew.trim()}
                className="inline-flex items-center gap-2 bg-neon text-primary-foreground font-bold px-4 py-2 rounded-md glow-neon disabled:opacity-50"
              >
                <Check className="h-4 w-4" /> שמור
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
