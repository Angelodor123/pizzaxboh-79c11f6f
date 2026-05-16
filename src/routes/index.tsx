import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { RecipeCard } from "@/components/RecipeCard";
import { categoryLabels, categoryOrder, type RecipeCategory } from "@/lib/cookbook";
import { useCookbookStore } from "@/lib/store";

export const Route = createFileRoute("/")({
  component: KitchenDashboard,
});

const allCats: (RecipeCategory | "all")[] = ["all", ...categoryOrder];

function KitchenDashboard() {
  const recipes = useCookbookStore((s) => s.recipes);
  const [cat, setCat] = useState<RecipeCategory | "all">("all");
  const [q, setQ] = useState("");

  const filtered = useMemo(
    () =>
      recipes
        .filter((r) => !r.deleted)
        .filter((r) => (cat === "all" ? true : r.category === cat))
        .filter((r) =>
          q.trim() ? r.nameHebrew.includes(q.trim()) : true,
        ),
    [recipes, cat, q],
  );

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="mb-6">
        <div className="text-[10px] uppercase tracking-[0.3em] text-amber-brand font-bold">
          Mise en Place
        </div>
        <h1 className="font-display text-4xl font-bold mt-1">
          מערכת <span className="text-neon text-glow-neon">הכנות</span>
        </h1>
        <p className="text-muted-foreground mt-2 text-sm">
          {filtered.length} מתכונים פעילים • סקיילינג, טיימרים ועלויות בזמן אמת.
        </p>
      </div>

      <div className="sticky top-16 z-30 -mx-4 px-4 py-3 bg-background/80 backdrop-blur border-b border-border mb-6 space-y-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="חיפוש מתכון..."
          className="w-full bg-input border border-border rounded-md px-3 py-2 text-sm"
        />
        <div className="flex gap-1.5 overflow-x-auto scrollbar-hide -mx-4 px-4">
          {allCats.map((c) => (
            <button
              key={c}
              onClick={() => setCat(c)}
              className={`shrink-0 px-3 py-2 rounded-md text-xs font-bold border transition whitespace-nowrap ${
                cat === c
                  ? "bg-deep-green text-jungle-foreground border-deep-green"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {c === "all" ? "הכל" : categoryLabels[c]}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((r) => (
          <RecipeCard key={r.id} recipe={r} />
        ))}
      </div>
    </div>
  );
}
