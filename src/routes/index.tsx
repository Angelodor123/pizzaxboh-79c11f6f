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
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="text-[10px] uppercase tracking-[0.3em] text-neon font-bold">
            Mise en Place
          </div>
          <h1 className="font-display text-4xl font-bold mt-1">
            מערכת <span className="text-neon text-glow-neon">הכנות</span>
          </h1>
          <p className="text-muted-foreground mt-3 text-sm leading-relaxed max-w-2xl">
            ברוכים הבאים למרכז הקולינרי של פיצה X. כאן תמצאו את כל המתכונים,
            הטכניקות והדיוקים שהופכים אותנו למי שאנחנו. עבדו לפי הסדר, הקפידו
            על הכמויות, וזכרו – הדיוק הוא המרכיב הכי חשוב במנה.
          </p>
        </div>

        <div className="shrink-0 flex items-center gap-3 rounded-2xl border border-neon/50 bg-card/60 backdrop-blur px-4 py-3 glow-neon">
          <div
            className="relative h-14 w-14 rounded-full flex items-center justify-center font-display font-black text-2xl text-neon text-glow-neon tabular-nums"
            style={{
              background:
                "radial-gradient(circle at center, rgba(255,20,147,0.15), transparent 70%)",
              border: "2px solid #FF1493",
            }}
          >
            {filtered.length}
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-[0.25em] text-neon font-bold">
              Live
            </div>
            <div className="text-xs font-bold text-foreground leading-tight max-w-[10rem]">
              מתכונים זמינים במערכת
            </div>
          </div>
        </div>
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
