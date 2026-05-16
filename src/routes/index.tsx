import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { RecipeCard } from "@/components/RecipeCard";
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
        .filter((r) => (q.trim() ? r.nameHebrew.includes(q.trim()) : true)),
    [recipes, cat, q],
  );

  return (
    <div className="max-w-7xl mx-auto px-4 py-5">
      <div className="mb-5">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-[0.3em] text-neon font-bold">
              Mise en Place
            </div>
            <h1 className="font-display text-3xl sm:text-4xl font-bold mt-1 leading-tight">
              מערכת <span className="text-neon text-glow-neon">הכנות</span>
            </h1>
          </div>

          <div
            className="shrink-0 flex flex-col items-center justify-center h-20 w-20 rounded-full border-2 border-neon glow-neon"
            style={{
              background:
                "radial-gradient(circle at center, rgba(255,20,147,0.18), transparent 70%)",
            }}
            aria-label={`${filtered.length} מתכונים`}
          >
            <span className="font-display font-black text-3xl text-neon text-glow-neon tabular-nums leading-none">
              {filtered.length}
            </span>
            <span className="text-[10px] font-bold tracking-[0.1em] text-neon mt-1">
              מתכונים
            </span>
          </div>
        </div>

        <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
          ברוכים הבאים למרכז הקולינרי של פיצה X. כאן תמצאו את כל המתכונים,
          הטכניקות והדיוקים שהופכים אותנו למי שאנחנו. עבדו לפי הסדר, הקפידו על
          הכמויות, וזכרו – הדיוק הוא המרכיב הכי חשוב במנה.
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
