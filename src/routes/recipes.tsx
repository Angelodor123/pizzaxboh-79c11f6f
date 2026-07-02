import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Search, Trash2, FolderInput, CheckSquare } from "lucide-react";
import { toast } from "sonner";
import { RecipeCard } from "@/components/RecipeCard";
import { useCookbookStore } from "@/lib/store";
import { useUIStore } from "@/lib/ui-store";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { categoryLabels, categoryOrder, type RecipeCategory } from "@/lib/cookbook";
import {
  BACK_OF_HOUSE_CATEGORIES,
  isMenuItem,
  MENU_ITEM_CATEGORIES,
  menuCategoryEmoji,
  menuCategoryLabels,
  menuCategoryOrder,
  recipeToMenuCategory,
  type MenuCategory,
} from "@/lib/menu-categories";


import { BulkActionBar } from "@/components/BulkActionBar";
import { useBulkSelection, useLongPress } from "@/hooks/use-bulk-selection";
import { NewRecipeDialog } from "@/components/NewRecipeDialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type RecipesSearch = { openRecipeId?: string };

export const Route = createFileRoute("/recipes")({
  head: () => ({
    meta: [
      { title: 'מתכונים — Pizza X' },
      { name: "description", content: 'ספריית המתכונים של מטבח Pizza X.' },
    
      { property: "og:title", content: 'מתכונים — Pizza X' },
      { property: "og:description", content: 'ספריית המתכונים של מטבח Pizza X.' },
      { property: "og:url", content: "https://pizzaxboh.lovable.app/recipes" },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: "https://pizzaxboh.lovable.app/recipes" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: "מתכונים — Pizza X",
          description: "ספריית המתכונים של מטבח Pizza X — רטבים, בצקים, מנות ותוספות.",
          url: "https://pizzaxboh.lovable.app/recipes",
          inLanguage: "he",
          isPartOf: { "@id": "https://pizzaxboh.lovable.app/#website" },
          about: { "@type": "Thing", name: "Recipe collection" },
          mainEntity: {
            "@type": "ItemList",
            name: "מתכוני Pizza X",
            itemListElement: [
              { "@type": "Recipe", name: "מתכוני בצקים ובסיסים", recipeCategory: "Dough & Bases", inLanguage: "he" },
              { "@type": "Recipe", name: "רטבי בסיס", recipeCategory: "Sauces", inLanguage: "he" },
              { "@type": "Recipe", name: "איולי ורטבים", recipeCategory: "Aiolis", inLanguage: "he" },
              { "@type": "Recipe", name: "ריבות וקרמים", recipeCategory: "Jams & Creams", inLanguage: "he" },
              { "@type": "Recipe", name: "מנות פתיחה", recipeCategory: "Starters", inLanguage: "he" },
              { "@type": "Recipe", name: "מנות עיקריות", recipeCategory: "Main Dishes", inLanguage: "he" },
            ],
          },
        }),
      },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): RecipesSearch => ({
    openRecipeId: typeof search.openRecipeId === "string" ? search.openRecipeId : undefined,
  }),
  component: KitchenDashboard,
});

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

function KitchenDashboard() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/recipes" });
  const recipes = useCookbookStore((s) => s.recipes);
  const cat = useUIStore((s) => s.category);
  const setCategory = useUIStore((s) => s.setCategory);
  const menuCat = useUIStore((s) => s.menuCategory);
  const setMenuCat = useUIStore((s) => s.setMenuCategory);
  const [q, setQ] = useState("");
  const { role } = useAuth();
  const canEdit = role === "admin";

  const bulk = useBulkSelection();
  const [moveOpen, setMoveOpen] = useState(false);
  const [forcedOpenRecipeId, setForcedOpenRecipeId] = useState<string | null>(null);

  const activeAll = useMemo(() => recipes.filter((r) => !r.deleted), [recipes]);
  // "מתכונים" = back-of-house only (sauces, bases, spices, aiolis, jams).
  // "מנות" = everything that lives on the customer-facing menu (dishes,
  // starters, desserts, pastas, salads...). This split is independent of
  // any individual recipe's internal category, so moving a pasta dish into
  // the "פסטות" category keeps it visible on the dishes page.
  const activeRecipes = useMemo(
    () => activeAll.filter((r) => !isMenuItem(r)),
    [activeAll],
  );
  const activeDishes = useMemo(
    () => activeAll.filter((r) => isMenuItem(r)),
    [activeAll],
  );

  useEffect(() => {
    const id = search.openRecipeId;
    if (!id) {
      setForcedOpenRecipeId(null);
      return;
    }
    if (activeAll.length === 0) return;
    const found = activeAll.find((r) => r.id === id);
    if (!found) return;
    if (isMenuItem(found)) {
      setCategory("dishes");
      setMenuCat("all");
    } else {
      setCategory("all");
    }
    setQ("");
    setForcedOpenRecipeId(id);
    // Retry scroll a few times — card may not be mounted yet on first frame
    let attempts = 0;
    const tryScroll = () => {
      const el = document.querySelector(`[data-recipe-row="${id}"]`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
      if (attempts++ < 20) setTimeout(tryScroll, 120);
    };
    requestAnimationFrame(tryScroll);
    // Slow-device fallback: one more scroll attempt after category re-render settles
    setTimeout(() => {
      const el = document.querySelector(`[data-recipe-row="${id}"]`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 600);
  }, [search.openRecipeId, activeAll, setCategory, setMenuCat]);

  // Treat any menu-item category selection as the dishes view so legacy
  // persisted state (e.g. cat === "pastas") doesn't strand items off-screen.
  const isDishesView =
    cat === "dishes" || (cat !== "all" && cat !== "desserts" && MENU_ITEM_CATEGORIES.includes(cat));


  const dishesWithMenuCat = useMemo(
    () => activeDishes.map((r) => ({ recipe: r, menuCategory: recipeToMenuCategory(r) })),
    [activeDishes],
  );

  const menuCountByCat = useMemo(() => {
    const m = new Map<MenuCategory, number>();
    for (const { menuCategory } of dishesWithMenuCat) {
      m.set(menuCategory, (m.get(menuCategory) ?? 0) + 1);
    }
    return m;
  }, [dishesWithMenuCat]);

  const filtered = useMemo(
    () => {
      let base;
      if (isDishesView) {
        base =
          menuCat === "all"
            ? activeDishes
            : dishesWithMenuCat.filter((d) => d.menuCategory === menuCat).map((d) => d.recipe);
      } else if (cat === "all") {
        base = activeRecipes;
      } else {
        base = activeRecipes.filter((r) => r.category === cat);
      }
      return q.trim() ? base.filter((r) => r.nameHebrew.includes(q.trim())) : base;
    },
    [activeAll, activeRecipes, activeDishes, dishesWithMenuCat, cat, menuCat, isDishesView, q],
  );

  const countByCat = useMemo(() => {
    const m = new Map<RecipeCategory, number>();
    for (const r of activeRecipes) m.set(r.category, (m.get(r.category) ?? 0) + 1);
    return m;
  }, [activeRecipes]);


  return (
    <div className="max-w-7xl mx-auto px-4 py-5">
      <div className="mb-5 text-center">
        <div className="text-[10px] uppercase tracking-[0.3em] text-neon font-bold">
          Mise en Place
        </div>
        <h1 className="font-display text-3xl sm:text-4xl font-bold mt-1 leading-tight">
          מערכת <span className="text-neon text-glow-neon">הכנות</span>
        </h1>

        <div className="mt-3 flex items-center justify-center gap-2">
          <div
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full border border-neon glow-neon"
            style={{
              background:
                "radial-gradient(circle at center, color-mix(in oklab, var(--neon) 18%, transparent), transparent 70%)",
            }}
            aria-label={`${activeRecipes.length} מתכונים`}
          >
            <span className="font-display font-black text-base text-neon tabular-nums leading-none">
              {activeRecipes.length}
            </span>
            <span className="text-[10px] font-bold tracking-[0.1em] text-neon">
              מתכונים
            </span>
          </div>
          {cat !== "all" && (
            <div
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full border border-jungle"
              style={{
                background:
                  "radial-gradient(circle at center, color-mix(in oklab, var(--jungle) 18%, transparent), transparent 70%)",
              }}
              aria-label={`${activeDishes.length} מנות`}
            >
              <span className="font-display font-black text-base text-jungle tabular-nums leading-none">
                {activeDishes.length}
              </span>
              <span className="text-[10px] font-bold tracking-[0.1em] text-jungle">
                מנות
              </span>
            </div>
          )}
        </div>

        <p className="hidden sm:block text-muted-foreground mt-3 text-sm leading-relaxed">
          ברוכים הבאים למרכז הקולינרי של פיצה X. עבדו לפי הסדר, הקפידו על הכמויות
          – הדיוק הוא המרכיב הכי חשוב.
        </p>
      </div>

      <div className="sticky top-16 sm:top-20 z-30 -mx-4 px-4 py-3 bg-background/90 backdrop-blur border-b border-border mb-4 space-y-3">
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="חיפוש מתכון..."
            aria-label="חיפוש מתכון"
            className="w-full bg-input border border-border rounded-md pr-9 pl-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neon/60 focus:border-neon"
          />
        </div>

        <div
          className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-thin"
          role="tablist"
          aria-label="קטגוריות מהירות"
        >
          {isDishesView ? (
            <>
              <button
                type="button"
                role="tab"
                aria-selected={menuCat === "all"}
                onClick={() => setMenuCat("all")}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold border transition whitespace-nowrap ${
                  menuCat === "all"
                    ? "bg-neon text-primary-foreground border-neon glow-neon"
                    : "border-border text-muted-foreground hover:text-neon hover:border-neon/60"
                }`}
              >
                🍽️ כל המנות
                <span className="opacity-70 tabular-nums mr-1">({activeDishes.length})</span>
              </button>
              {menuCategoryOrder.map((key) => {
                const count = menuCountByCat.get(key) ?? 0;
                if (count === 0) return null;
                const active = menuCat === key;
                return (
                  <button
                    key={key}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setMenuCat(key)}
                    className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold border transition whitespace-nowrap ${
                      active
                        ? "bg-neon text-primary-foreground border-neon glow-neon"
                        : "border-border text-muted-foreground hover:text-neon hover:border-neon/60"
                    }`}
                  >
                    {menuCategoryEmoji[key]} {menuCategoryLabels[key]}
                    <span className="opacity-70 tabular-nums mr-1">({count})</span>
                  </button>
                );
              })}
            </>
          ) : (
            <>
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
              {BACK_OF_HOUSE_CATEGORIES.map((key) => {
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
            </>
          )}
        </div>
      </div>

      {canEdit && (
        <div className="flex items-center justify-center gap-2 mb-3 flex-wrap">
          <NewRecipeDialog mode={isDishesView ? "dish" : "recipe"} />
          {filtered.length > 0 && (
            <button
              type="button"
              onClick={() => bulk.toggleAll(filtered.map((r) => r.id))}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-border text-xs font-bold hover:border-neon hover:text-neon"
            >
              <CheckSquare className="h-3.5 w-3.5" />
              {bulk.selectionMode ? "סיים בחירה" : "בחר מרובה"}
            </button>
          )}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground text-sm">
          לא נמצאו מתכונים תואמים.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((r) => (
            <SelectableRecipeCard
              key={r.id}
              recipeId={r.id}
              selectionMode={canEdit && bulk.selectionMode}
              selected={bulk.isSelected(r.id)}
              onToggle={() => bulk.toggle(r.id)}
              onLongPress={() => bulk.enter(r.id)}
            >
              <RecipeCard
                recipe={r}
                forceOpen={forcedOpenRecipeId === r.id}
                onForcedOpen={() => {
                  // Clear the URL param without re-triggering the open effect mid-mount.
                  // We delay so the card finishes its open animation/scroll first.
                  setTimeout(() => {
                    navigate({ search: {} as any, replace: true });
                  }, 600);
                }}
              />

            </SelectableRecipeCard>
          ))}
        </div>
      )}

      {canEdit && (
        <BulkActionBar
          count={bulk.count}
          totalCount={filtered.length}
          allSelected={bulk.count === filtered.length && filtered.length > 0}
          onClear={bulk.clear}
          onSelectAll={() => bulk.toggleAll(filtered.map((r) => r.id))}
          actions={[
            {
              key: "move",
              label: "העבר קטגוריה",
              icon: FolderInput,
              onClick: () => setMoveOpen(true),
            },
            {
              key: "delete",
              label: "מחק",
              icon: Trash2,
              variant: "destructive",
              confirm: "למחוק {count} מתכונים? פעולה זו בלתי הפיכה (מחיקה רכה).",
              onClick: async () => {
                const ids = bulk.ids;
                const { error } = await supabase
                  .from("recipes")
                  .update({ deleted: true })
                  .in("id", ids);
                if (error) {
                  toast.error("שגיאה במחיקה: " + error.message);
                  return;
                }
                toast.success(`נמחקו ${ids.length} מתכונים`);
                bulk.clear();
                void useCookbookStore.getState().refresh();
              },
            },
          ]}
        />
      )}

      <Dialog open={moveOpen} onOpenChange={setMoveOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>העבר {bulk.count} מתכונים לקטגוריה</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2">
            {categoryOrder.map((key) => (
              <button
                key={key}
                type="button"
                onClick={async () => {
                  const ids = bulk.ids;
                  const { error } = await supabase
                    .from("recipes")
                    .update({ category: key })
                    .in("id", ids);
                  if (error) {
                    toast.error("שגיאה: " + error.message);
                    return;
                  }
                  toast.success(`הועברו ${ids.length} מתכונים`);
                  setMoveOpen(false);
                  bulk.clear();
                  void useCookbookStore.getState().refresh();
                }}
                className="h-11 rounded-md border border-border text-sm font-bold hover:border-neon hover:text-neon text-right px-3"
              >
                {CATEGORY_EMOJI[key]} {categoryLabels[key]}
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SelectableRecipeCard({
  recipeId,
  selectionMode,
  selected,
  onToggle,
  onLongPress,
  children,
}: {
  recipeId: string;
  selectionMode: boolean;
  selected: boolean;
  onToggle: () => void;
  onLongPress: () => void;
  children: React.ReactNode;
}) {
  const lp = useLongPress(onLongPress);
  return (
    <div
      className={`relative rounded-2xl transition ${
        selected ? "ring-2 ring-neon ring-offset-2 ring-offset-background" : ""
      }`}
      {...lp}
      onClickCapture={(e) => {
        if (selectionMode) {
          e.preventDefault();
          e.stopPropagation();
          onToggle();
        }
      }}
      data-recipe-row={recipeId}
    >
      {selectionMode && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          aria-pressed={selected}
          aria-label={selected ? "הסר מהבחירה" : "הוסף לבחירה"}
          className={`absolute top-2 left-2 z-10 h-7 w-7 grid place-content-center rounded-full border-2 transition ${
            selected
              ? "bg-neon border-neon text-primary-foreground"
              : "bg-card/80 border-border hover:border-neon"
          }`}
        >
          {selected ? "✓" : ""}
        </button>
      )}
      {children}
    </div>
  );
}
