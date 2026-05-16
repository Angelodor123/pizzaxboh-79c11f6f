import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { RecipeCard } from "@/components/RecipeCard";
import { categoryLabels } from "@/lib/cookbook";
import { useCookbookStore } from "@/lib/store";
import { useUIStore } from "@/lib/ui-store";

export const Route = createFileRoute("/")({
  component: KitchenDashboard,
});

function KitchenDashboard() {
  const recipes = useCookbookStore((s) => s.recipes);
  const cat = useUIStore((s) => s.category);
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

  const catLabel = cat === "all" ? "כל הקטגוריות" : categoryLabels[cat];

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="mb-6">
        <div className="text-[10px] uppercase tracking-[0.3em] text-neon font-bold">
          Mise en Place
        </div>
        <h1 className="font-display text-4xl font-bold mt-1">
          מערכת <span className="text-neon text-glow-neon">הכנות</span>
        </h1>
        <p className="text-muted-foreground mt-2 text-sm">
          {catLabel} • {filtered.length} מתכונים פעילים
        </p>
      </div>

      <div className="sticky top-16 z-30 -mx-4 px-4 py-3 bg-background/80 backdrop-blur border-b border-border mb-6">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="חיפוש מתכון..."
          className="w-full bg-input border border-border rounded-md px-3 py-2 text-sm"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((r) => (
          <RecipeCard key={r.id} recipe={r} />
        ))}
      </div>
    </div>
  );
}
