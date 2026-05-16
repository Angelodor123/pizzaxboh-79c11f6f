import { useEffect } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { pizzaXCookbook, type Recipe, type RecipeCategory, type Ingredient, type SpiceBag } from "./cookbook";
import { supabase } from "@/integrations/supabase/client";

export interface IngredientPrice {
  name: string;
  unitPrice: number;
  unit: string;
  updatedAt: string;
  source: "manual" | "invoice-ai";
}

export interface AuditEntry {
  id: string;
  at: string;
  action: string;
}

// =========================================
// Cloud-backed recipes store
// =========================================

interface RecipesState {
  recipes: Recipe[];
  loading: boolean;
  error: string | null;
  setRecipes: (r: Recipe[]) => void;
  upsertLocal: (r: Recipe) => void;
  removeLocal: (id: string) => void;
  addRecipe: (r: Recipe) => Promise<void>;
  updateRecipe: (id: string, r: Recipe) => Promise<void>;
  softDeleteRecipe: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
}

interface DbRecipeRow {
  id: string;
  category: string;
  name_hebrew: string;
  base_yield_hebrew: string;
  essence_hebrew: string | null;
  ingredients: Ingredient[];
  spice_bag: SpiceBag | null;
  instructions_hebrew: string;
  timer_seconds: number | null;
  texture_target_hebrew: string | null;
  technique_notes_hebrew: string | null;
  deleted: boolean;
  sort_order: number;
}

function rowToRecipe(row: DbRecipeRow): Recipe {
  return {
    id: row.id,
    category: row.category as RecipeCategory,
    nameHebrew: row.name_hebrew,
    baseYieldHebrew: row.base_yield_hebrew ?? "",
    essenceHebrew: row.essence_hebrew ?? undefined,
    ingredients: Array.isArray(row.ingredients) ? row.ingredients : [],
    spiceBag: row.spice_bag ?? undefined,
    instructionsHebrew: row.instructions_hebrew ?? "",
    timerSeconds: row.timer_seconds ?? undefined,
    textureTargetHebrew: row.texture_target_hebrew ?? undefined,
    techniqueNotesHebrew: row.technique_notes_hebrew ?? undefined,
    deleted: row.deleted,
  };
}

function recipeToRow(r: Recipe): Omit<DbRecipeRow, "sort_order"> & { sort_order?: number } {
  return {
    id: r.id,
    category: r.category,
    name_hebrew: r.nameHebrew,
    base_yield_hebrew: r.baseYieldHebrew ?? "",
    essence_hebrew: r.essenceHebrew ?? null,
    ingredients: r.ingredients ?? [],
    spice_bag: r.spiceBag ?? null,
    instructions_hebrew: r.instructionsHebrew ?? "",
    timer_seconds: r.timerSeconds ?? null,
    texture_target_hebrew: r.textureTargetHebrew ?? null,
    technique_notes_hebrew: r.techniqueNotesHebrew ?? null,
    deleted: r.deleted ?? false,
  };
}

export const useCookbookStore = create<RecipesState>((set, get) => ({
  recipes: [],
  loading: true,
  error: null,
  setRecipes: (r) => set({ recipes: r, loading: false, error: null }),
  upsertLocal: (r) =>
    set((s) => {
      const idx = s.recipes.findIndex((x) => x.id === r.id);
      if (idx === -1) return { recipes: [...s.recipes, r] };
      const next = [...s.recipes];
      next[idx] = r;
      return { recipes: next };
    }),
  removeLocal: (id) =>
    set((s) => ({ recipes: s.recipes.filter((x) => x.id !== id) })),
  refresh: async () => {
    const { data, error } = await supabase
      .from("recipes")
      .select("*")
      .order("sort_order", { ascending: true });
    if (error) {
      set({ error: error.message, loading: false });
      return;
    }
    set({
      recipes: (data ?? []).map((row) => rowToRecipe(row as unknown as DbRecipeRow)),
      loading: false,
      error: null,
    });
  },
  addRecipe: async (r) => {
    const row = recipeToRow(r);
    const sortOrder = (get().recipes.length + 1) * 10 + 1000;
    const { data, error } = await supabase
      .from("recipes")
      .insert({ ...row, sort_order: sortOrder } as never)
      .select()
      .single();
    if (error) throw error;
    if (data) get().upsertLocal(rowToRecipe(data as unknown as DbRecipeRow));
  },
  updateRecipe: async (id, r) => {
    const row = recipeToRow(r);
    const { data, error } = await supabase
      .from("recipes")
      .update(row as never)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    if (data) get().upsertLocal(rowToRecipe(data as unknown as DbRecipeRow));
  },
  softDeleteRecipe: async (id) => {
    const { error } = await supabase
      .from("recipes")
      .update({ deleted: true })
      .eq("id", id);
    if (error) throw error;
    set((s) => ({
      recipes: s.recipes.map((x) => (x.id === id ? { ...x, deleted: true } : x)),
    }));
  },
}));

/**
 * Mount once at app root: loads recipes from cloud and subscribes to realtime
 * changes so every signed-in user sees edits live.
 */
export function useRecipesSync() {
  const refresh = useCookbookStore((s) => s.refresh);
  const upsertLocal = useCookbookStore((s) => s.upsertLocal);
  const removeLocal = useCookbookStore((s) => s.removeLocal);

  useEffect(() => {
    refresh();
    const channel = supabase
      .channel("recipes-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "recipes" },
        (payload) => {
          if (payload.eventType === "DELETE") {
            const oldRow = payload.old as { id?: string };
            if (oldRow?.id) removeLocal(oldRow.id);
            return;
          }
          const row = payload.new as DbRecipeRow | undefined;
          if (row) upsertLocal(rowToRecipe(row));
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [refresh, upsertLocal, removeLocal]);
}

// Re-export seed for safety (unused now that data lives in DB).
export const SEED_RECIPES = pizzaXCookbook;

// =========================================
// Pricing store (still local — separate concern)
// =========================================

interface PricingState {
  prices: Record<string, IngredientPrice>;
  audit: AuditEntry[];
  setPrice: (name: string, price: IngredientPrice) => void;
  setPricesBulk: (prices: IngredientPrice[]) => void;
  log: (action: string) => void;
  resetData: () => void;
}

const seedPrices: Record<string, IngredientPrice> = Object.fromEntries(
  [
    ["מיונז", 18, "ק\"ג"],
    ["שמנת", 14, "ליטר"],
    ["שמנת לבישול 'פקק צהוב'", 14, "ליטר"],
    ["סוכר", 4.5, "ק\"ג"],
    ["מלח", 3, "ק\"ג"],
    ["שום קונפי", 60, "ק\"ג"],
    ["שום קלוף", 22, "ק\"ג"],
    ["בצל סגול חתוך", 6, "ק\"ג"],
    ["בייקון קצוץ", 75, "ק\"ג"],
    ["בזיליקום", 90, "ק\"ג"],
    ["שמן זית", 38, "ליטר"],
    ["שמן קנולה", 12, "ליטר"],
    ["פרמזן", 140, "ק\"ג"],
    ["פקורינו רומנו", 160, "ק\"ג"],
    ["כמהין", 1200, "ק\"ג"],
    ["מחית כמהין", 800, "ק\"ג"],
    ["דבש", 32, "ק\"ג"],
    ["חרדל חלק", 28, "ק\"ג"],
    ["אנשובי", 95, "ק\"ג"],
    ["צלפים", 60, "ק\"ג"],
    ["מיץ לימון", 14, "ליטר"],
    ["נוטלה", 38, "ק\"ג"],
    ["קינדר", 95, "ק\"ג"],
    ["חלב", 5.5, "ליטר"],
  ].map(([name, price, unit]) => [
    String(name),
    {
      name: String(name),
      unitPrice: Number(price),
      unit: String(unit),
      updatedAt: new Date().toISOString(),
      source: "manual" as const,
    },
  ]),
);

function prepend(list: AuditEntry[], action: string): AuditEntry[] {
  return [
    { id: crypto.randomUUID(), at: new Date().toISOString(), action },
    ...list,
  ].slice(0, 50);
}

export const usePricingStore = create<PricingState>()(
  persist(
    (set) => ({
      prices: seedPrices,
      audit: [],
      setPrice: (name, price) =>
        set((s) => ({
          prices: { ...s.prices, [name]: price },
          audit: prepend(s.audit, `מחיר עודכן ידנית: ${name} → ₪${price.unitPrice}/${price.unit}`),
        })),
      setPricesBulk: (list) =>
        set((s) => {
          const next = { ...s.prices };
          for (const p of list) next[p.name] = p;
          return {
            prices: next,
            audit: prepend(s.audit, `חשבונית AI: עודכנו ${list.length} מחירי מצרכים`),
          };
        }),
      log: (action) => set((s) => ({ audit: prepend(s.audit, action) })),
      resetData: () =>
        set({
          prices: seedPrices,
          audit: [
            {
              id: crypto.randomUUID(),
              at: new Date().toISOString(),
              action: "איפוס מחירים לברירת מחדל",
            },
          ],
        }),
    }),
    { name: "pizzax-pricing-v1" },
  ),
);

// =========================================
// Pricing helpers
// =========================================

const UNIT_TO_BASE: Record<string, { base: string; factor: number }> = {
  "ק\"ג": { base: "ק\"ג", factor: 1 },
  "גרם": { base: "ק\"ג", factor: 0.001 },
  "ליטר": { base: "ליטר", factor: 1 },
  "מ\"ל": { base: "ליטר", factor: 0.001 },
  "יחידות": { base: "יחידה", factor: 1 },
  "יחידה": { base: "יחידה", factor: 1 },
};

export function estimateIngredientCost(
  ingredientName: string,
  quantity: number,
  unit: string,
  prices: Record<string, IngredientPrice>,
): number | null {
  const price = prices[ingredientName];
  if (!price) return null;
  const recipeUnit = UNIT_TO_BASE[unit];
  const priceUnit = UNIT_TO_BASE[price.unit];
  if (!recipeUnit || !priceUnit) return null;
  if (recipeUnit.base !== priceUnit.base) return null;
  const qtyInBase = quantity * recipeUnit.factor;
  const qtyInPriceUnit = qtyInBase / priceUnit.factor;
  return qtyInPriceUnit * price.unitPrice;
}

export function estimateRecipeCost(
  recipe: Recipe,
  scale: number,
  prices: Record<string, IngredientPrice>,
): { total: number; known: number; unknown: number } {
  let total = 0;
  let known = 0;
  let unknown = 0;
  const all = [
    ...recipe.ingredients,
    ...(recipe.spiceBag?.items ?? []),
  ];
  for (const ing of all) {
    const c = estimateIngredientCost(ing.name, ing.quantity * scale, ing.unit, prices);
    if (c == null) unknown++;
    else {
      total += c;
      known++;
    }
  }
  return { total, known, unknown };
}
