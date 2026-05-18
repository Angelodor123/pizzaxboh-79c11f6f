import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { RecipeCard } from "@/components/RecipeCard";
import { useCookbookStore } from "@/lib/store";
import { useUIStore } from "@/lib/ui-store";
import { categoryLabels, categoryOrder, type RecipeCategory } from "@/lib/cookbook";

export const Route = createFileRoute("/recipes")({
  component: KitchenDashboard,
});

const CATEGORY_EMOJI: Record<RecipeCategory, string> = {
  dishes: "🍕",
  sauces_bases: "🍅",
  aiolis_sauces: "🍯",
  jams_creams: "🥘",
  starters: "🌽",
  spices: "🧂",
  desserts: "🍪",
  pastas: "🍝",
  authentic_pastas: "🇮🇹",
  salads: "🥗",
};

function KitchenDashboard() {
  const recipes = useCookbookStore((s) => s.recipes);
  const cat = useUIStore((s) => s.category);
  const setCategory = useUIStore((s) => s.setCategory);
  const [q, setQ] = useState("");

  const filtered = useMemo(
    () =>
      recipes
        .filter((r) => !r.deleted)
        .filter((r) => (cat === "all" ? true : r.category === cat))
        .filter((r) => (q.trim() ? r.nameHebrew.includes(q.trim()) : true)),
    [recipes, cat, q],
  );

  const activeAll = useMemo(() => recipes.filter((r) => !r.deleted), [recipes]);
  const activeRecipes = useMemo(() => activeAll.filter((r) => r.category !== "dishes"), [activeAll]);
  const activeDishes = useMemo(() => activeAll.filter((r) => r.category === "dishes"), [activeAll]);
  const countByCat = useMemo(() => {
    const m = new Map<RecipeCategory, number>();
    for (const r of activeAll) m.set(r.category, (m.get(r.category) ?? 0) + 1);
    return m;
  }, [activeAll]);

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
            aria-label={`${activeRecipes.length} מתכונים`}
          >
            <span className="font-display font-black text-3xl text-neon text-glow-neon tabular-nums leading-none">
              {activeRecipes.length}
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

      <div className="sticky top-24 z-30 -mx-4 px-4 py-3 bg-background/90 backdrop-blur border-b border-border mb-6 space-y-3">
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="חיפוש מתכון..."
            className="w-full bg-input border border-border rounded-md pr-9 pl-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neon/60 focus:border-neon"
          />
        </div>

        <div
          className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-thin"
          role="tablist"
          aria-label="קטגוריות מהירות"
        >
          <button
            type="button"
            role="tab"
            aria-selected={cat === "all"}
            onClick={() => setCategory("all")}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold border transition whitespace-nowrap ${
              cat === "all"
                ? "bg-neon text-primary-foreground border-neon glow-neon"
                : "border-border text-muted-foreground hover:text-neon hover:border-neon/60"
            }`}
          >
            📋 הכל
            <span className="opacity-70 tabular-nums mr-1">({activeRecipes.length})</span>
          </button>
          {categoryOrder.map((key) => {
            const active = cat === key;
            const count = countByCat.get(key) ?? 0;
            if (count === 0) return null;
            return (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setCategory(key)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold border transition whitespace-nowrap ${
                  active
                    ? "bg-neon text-primary-foreground border-neon glow-neon"
                    : "border-border text-muted-foreground hover:text-neon hover:border-neon/60"
                }`}
              >
                {CATEGORY_EMOJI[key]} {categoryLabels[key]}
                <span className="opacity-70 tabular-nums mr-1">({count})</span>
              </button>
            );
          })}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground text-sm">
          לא נמצאו מתכונים תואמים.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((r) => (
            <RecipeCard key={r.id} recipe={r} />
          ))}
        </div>
      )}
    </div>
  );
}
