import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  categoryLabels,
  type Recipe,
  type RecipeCategory,
} from "@/lib/cookbook";
import { useCookbookStore, type IngredientPrice } from "@/lib/store";

export const Route = createFileRoute("/admin")({
  component: AdminPage,
});

type Tab = "recipes" | "prices" | "audit";

function AdminPage() {
  const [tab, setTab] = useState<Tab>("recipes");
  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="text-[10px] uppercase tracking-[0.3em] text-amber-brand font-bold">
        Admin Panel
      </div>
      <h1 className="font-display text-4xl font-bold mt-1">
        חדר <span className="text-neon text-glow-neon">בקרה</span>
      </h1>
      <div className="mt-5 flex gap-2 border-b border-border">
        {[
          { id: "recipes" as const, label: "מתכונים" },
          { id: "prices" as const, label: "מחירי מצרכים" },
          { id: "audit" as const, label: "יומן פעולות" },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-bold border-b-2 -mb-px ${
              tab === t.id ? "border-neon text-neon" : "border-transparent text-muted-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="mt-6">
        {tab === "recipes" && <RecipesAdmin />}
        {tab === "prices" && <PricesAdmin />}
        {tab === "audit" && <AuditList />}
      </div>
    </div>
  );
}

function RecipesAdmin() {
  const recipes = useCookbookStore((s) => s.recipes);
  const updateRecipe = useCookbookStore((s) => s.updateRecipe);
  const addRecipe = useCookbookStore((s) => s.addRecipe);
  const softDelete = useCookbookStore((s) => s.softDeleteRecipe);
  const [editing, setEditing] = useState<Recipe | null>(null);

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-muted-foreground">
          {recipes.filter((r) => !r.deleted).length} פעילים / {recipes.length} סה״כ
        </p>
        <button
          onClick={() =>
            setEditing({
              id: crypto.randomUUID(),
              category: "sauces_bases",
              nameHebrew: "",
              baseYieldHebrew: "",
              ingredients: [],
              instructionsHebrew: "",
            })
          }
          className="px-4 py-2 rounded-md bg-neon text-primary-foreground font-bold text-sm glow-neon"
        >
          + מתכון חדש
        </button>
      </div>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-right bg-card text-xs text-muted-foreground">
              <th className="p-3">שם</th>
              <th className="p-3">קטגוריה</th>
              <th className="p-3">סטטוס</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {recipes.map((r) => (
              <tr key={r.id} className="border-t border-border">
                <td className="p-3 font-bold">{r.nameHebrew}</td>
                <td className="p-3 text-muted-foreground">{categoryLabels[r.category]}</td>
                <td className="p-3">
                  {r.deleted ? (
                    <span className="text-destructive text-xs">נמחק</span>
                  ) : (
                    <span className="text-jungle text-xs">פעיל</span>
                  )}
                </td>
                <td className="p-3 flex gap-2 justify-end">
                  <button
                    onClick={() => setEditing(r)}
                    className="px-3 py-1.5 text-xs rounded-md border border-border hover:border-neon"
                  >
                    ערוך
                  </button>
                  {!r.deleted && (
                    <button
                      onClick={() => softDelete(r.id)}
                      className="px-3 py-1.5 text-xs rounded-md border border-destructive/50 text-destructive"
                    >
                      מחק
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <RecipeEditor
          recipe={editing}
          onClose={() => setEditing(null)}
          onSave={(r) => {
            const exists = recipes.some((x) => x.id === r.id);
            if (exists) updateRecipe(r.id, r);
            else addRecipe(r);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function RecipeEditor({
  recipe,
  onSave,
  onClose,
}: {
  recipe: Recipe;
  onSave: (r: Recipe) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<Recipe>(recipe);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 grid place-items-center p-4" onClick={onClose}>
      <div
        className="max-w-2xl w-full max-h-[90vh] overflow-y-auto bg-card border border-border rounded-2xl p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-display text-xl font-bold">עריכת מתכון</h3>
          <button onClick={onClose} className="text-muted-foreground">✕</button>
        </div>
        <div className="space-y-3">
          <Field label="שם בעברית">
            <input
              value={draft.nameHebrew}
              onChange={(e) => setDraft({ ...draft, nameHebrew: e.target.value })}
              className="w-full bg-input border border-border rounded-md px-3 py-2 text-sm"
            />
          </Field>
          <Field label="קטגוריה">
            <select
              value={draft.category}
              onChange={(e) =>
                setDraft({ ...draft, category: e.target.value as RecipeCategory })
              }
              className="w-full bg-input border border-border rounded-md px-3 py-2 text-sm"
            >
              {Object.entries(categoryLabels).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </Field>
          <Field label="תפוקה בסיסית">
            <input
              value={draft.baseYieldHebrew}
              onChange={(e) => setDraft({ ...draft, baseYieldHebrew: e.target.value })}
              className="w-full bg-input border border-border rounded-md px-3 py-2 text-sm"
            />
          </Field>
          <Field label="הוראות הכנה">
            <textarea
              value={draft.instructionsHebrew}
              onChange={(e) => setDraft({ ...draft, instructionsHebrew: e.target.value })}
              rows={4}
              className="w-full bg-input border border-border rounded-md px-3 py-2 text-sm"
            />
          </Field>
          <Field label="טיימר (שניות, אופציונלי)">
            <input
              type="number"
              value={draft.timerSeconds ?? ""}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  timerSeconds: e.target.value ? Number(e.target.value) : undefined,
                })
              }
              className="w-full bg-input border border-border rounded-md px-3 py-2 text-sm"
            />
          </Field>
          <div>
            <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">
              מצרכים
            </div>
            {draft.ingredients.map((ing, i) => (
              <div key={i} className="flex gap-2 mb-1.5">
                <input
                  placeholder="שם"
                  value={ing.name}
                  onChange={(e) => {
                    const next = [...draft.ingredients];
                    next[i] = { ...next[i], name: e.target.value };
                    setDraft({ ...draft, ingredients: next });
                  }}
                  className="flex-1 bg-input border border-border rounded-md px-2 py-1.5 text-sm"
                />
                <input
                  type="number"
                  step="0.1"
                  value={ing.quantity}
                  onChange={(e) => {
                    const next = [...draft.ingredients];
                    next[i] = { ...next[i], quantity: Number(e.target.value) };
                    setDraft({ ...draft, ingredients: next });
                  }}
                  className="w-20 bg-input border border-border rounded-md px-2 py-1.5 text-sm tabular-nums"
                />
                <input
                  value={ing.unit}
                  onChange={(e) => {
                    const next = [...draft.ingredients];
                    next[i] = { ...next[i], unit: e.target.value };
                    setDraft({ ...draft, ingredients: next });
                  }}
                  className="w-24 bg-input border border-border rounded-md px-2 py-1.5 text-sm"
                />
                <button
                  onClick={() => {
                    const next = draft.ingredients.filter((_, j) => j !== i);
                    setDraft({ ...draft, ingredients: next });
                  }}
                  className="px-2 text-destructive"
                >
                  ✕
                </button>
              </div>
            ))}
            <button
              onClick={() =>
                setDraft({
                  ...draft,
                  ingredients: [...draft.ingredients, { name: "", quantity: 0, unit: "גרם" }],
                })
              }
              className="mt-2 px-3 py-1.5 text-xs rounded-md border border-border"
            >
              + מצרך
            </button>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-md border border-border">
            ביטול
          </button>
          <button
            onClick={() => onSave(draft)}
            className="px-4 py-2 text-sm rounded-md bg-neon text-primary-foreground font-bold glow-neon"
          >
            שמור
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-xs font-bold text-muted-foreground mb-1">{label}</div>
      {children}
    </label>
  );
}

function PricesAdmin() {
  const prices = useCookbookStore((s) => s.prices);
  const setPrice = useCookbookStore((s) => s.setPrice);
  const recipes = useCookbookStore((s) => s.recipes);
  const [q, setQ] = useState("");

  const allIngredientNames = useMemo(() => {
    const set = new Set<string>(Object.keys(prices));
    for (const r of recipes) {
      for (const i of r.ingredients) set.add(i.name);
      for (const i of r.spiceBag?.items ?? []) set.add(i.name);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "he"));
  }, [prices, recipes]);

  const filtered = allIngredientNames.filter((n) => n.includes(q.trim()));

  return (
    <div>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="חיפוש מצרך..."
        className="mb-4 w-full md:w-80 bg-input border border-border rounded-md px-3 py-2 text-sm"
      />
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-right bg-card text-xs text-muted-foreground">
              <th className="p-3">מצרך</th>
              <th className="p-3">מחיר ליחידה</th>
              <th className="p-3">יחידה</th>
              <th className="p-3">מקור</th>
              <th className="p-3">עודכן</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((name) => {
              const p: IngredientPrice = prices[name] ?? {
                name,
                unitPrice: 0,
                unit: "ק\"ג",
                updatedAt: "",
                source: "manual",
              };
              return (
                <tr key={name} className="border-t border-border">
                  <td className="p-3 font-bold">{name}</td>
                  <td className="p-3">
                    <input
                      type="number"
                      step="0.1"
                      value={p.unitPrice}
                      onChange={(e) =>
                        setPrice(name, {
                          ...p,
                          name,
                          unitPrice: Number(e.target.value),
                          updatedAt: new Date().toISOString(),
                          source: "manual",
                        })
                      }
                      className="w-24 bg-input border border-border rounded-md px-2 py-1.5 text-sm tabular-nums"
                    />
                  </td>
                  <td className="p-3">
                    <select
                      value={p.unit}
                      onChange={(e) =>
                        setPrice(name, {
                          ...p,
                          name,
                          unit: e.target.value,
                          updatedAt: new Date().toISOString(),
                          source: "manual",
                        })
                      }
                      className="bg-input border border-border rounded-md px-2 py-1.5 text-sm"
                    >
                      <option value="ק&quot;ג">ק״ג</option>
                      <option value="ליטר">ליטר</option>
                      <option value="יחידה">יחידה</option>
                    </select>
                  </td>
                  <td className="p-3">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        p.source === "invoice-ai"
                          ? "bg-neon/20 text-neon"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {p.source === "invoice-ai" ? "AI" : "ידני"}
                    </span>
                  </td>
                  <td className="p-3 text-xs text-muted-foreground">
                    {p.updatedAt ? new Date(p.updatedAt).toLocaleString("he-IL") : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AuditList() {
  const audit = useCookbookStore((s) => s.audit);
  const reset = useCookbookStore((s) => s.resetData);
  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <p className="text-sm text-muted-foreground">10 פעולות אחרונות</p>
        <button
          onClick={() => {
            if (confirm("לאפס את כל הנתונים?")) reset();
          }}
          className="px-3 py-1.5 text-xs rounded-md border border-destructive/50 text-destructive"
        >
          איפוס נתונים
        </button>
      </div>
      <ol className="space-y-2">
        {audit.slice(0, 10).map((e) => (
          <li
            key={e.id}
            className="flex items-start gap-3 p-3 rounded-md border border-border bg-card"
          >
            <span className="w-1.5 h-1.5 mt-2 rounded-full bg-neon glow-neon shrink-0"></span>
            <div className="flex-1">
              <div className="text-sm font-bold">{e.action}</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {new Date(e.at).toLocaleString("he-IL")}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
