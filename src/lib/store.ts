import { create } from "zustand";
import { persist } from "zustand/middleware";
import { pizzaXCookbook, type Recipe } from "./cookbook";

export interface IngredientPrice {
  name: string;
  unitPrice: number; // price per base unit (per gram / ml / unit)
  unit: string;
  updatedAt: string;
  source: "manual" | "invoice-ai";
}

export interface AuditEntry {
  id: string;
  at: string;
  action: string;
}

interface CookbookState {
  recipes: Recipe[];
  prices: Record<string, IngredientPrice>;
  audit: AuditEntry[];
  addRecipe: (r: Recipe) => void;
  updateRecipe: (id: string, r: Recipe) => void;
  softDeleteRecipe: (id: string) => void;
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

export const useCookbookStore = create<CookbookState>()(
  persist(
    (set) => ({
      recipes: pizzaXCookbook,
      prices: seedPrices,
      audit: [
        {
          id: crypto.randomUUID(),
          at: new Date().toISOString(),
          action: "אתחול מערכת — נטענו 24 מתכוני בסיס",
        },
      ],
      addRecipe: (r) =>
        set((s) => ({
          recipes: [...s.recipes, r],
          audit: prepend(s.audit, `נוסף מתכון חדש: ${r.nameHebrew}`),
        })),
      updateRecipe: (id, r) =>
        set((s) => ({
          recipes: s.recipes.map((x) => (x.id === id ? r : x)),
          audit: prepend(s.audit, `עודכן מתכון: ${r.nameHebrew}`),
        })),
      softDeleteRecipe: (id) =>
        set((s) => ({
          recipes: s.recipes.map((x) =>
            x.id === id ? { ...x, deleted: true } : x,
          ),
          audit: prepend(
            s.audit,
            `נמחק (רך) מתכון: ${s.recipes.find((x) => x.id === id)?.nameHebrew ?? id}`,
          ),
        })),
      setPrice: (name, price) =>
        set((s) => ({
          prices: { ...s.prices, [name]: price },
          audit: prepend(
            s.audit,
            `מחיר עודכן ידנית: ${name} → ₪${price.unitPrice}/${price.unit}`,
          ),
        })),
      setPricesBulk: (list) =>
        set((s) => {
          const next = { ...s.prices };
          for (const p of list) next[p.name] = p;
          return {
            prices: next,
            audit: prepend(
              s.audit,
              `חשבונית AI: עודכנו ${list.length} מחירי מצרכים`,
            ),
          };
        }),
      log: (action) =>
        set((s) => ({ audit: prepend(s.audit, action) })),
      resetData: () =>
        set({
          recipes: pizzaXCookbook,
          prices: seedPrices,
          audit: [
            {
              id: crypto.randomUUID(),
              at: new Date().toISOString(),
              action: "איפוס נתונים לברירת מחדל",
            },
          ],
        }),
    }),
    { name: "pizzax-cookbook-v1" },
  ),
);

function prepend(list: AuditEntry[], action: string): AuditEntry[] {
  return [
    { id: crypto.randomUUID(), at: new Date().toISOString(), action },
    ...list,
  ].slice(0, 50);
}

// Pricing helpers — normalize quantity to base units used in prices map.
// Heuristic: kg→g divide by 1000 when price unit is "גרם" and recipe unit is "ק\"ג", etc.
// For MVP we treat price unit as the canonical and convert common pairs.
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
  const priceInBase = price.unitPrice / priceUnit.factor; // price per base unit
  // priceInBase is per 1 unit of base; if price unit was "גרם" at 0.001 factor that means per 0.001 kg
  // so price per kg = price.unitPrice / 0.001 — but that's wrong. Fix:
  // Actually price.unitPrice is per price.unit (e.g. ₪14 per "ליטר"). Convert qty into price.unit:
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
    const c = estimateIngredientCost(
      ing.name,
      ing.quantity * scale,
      ing.unit,
      prices,
    );
    if (c == null) unknown++;
    else {
      total += c;
      known++;
    }
  }
  return { total, known, unknown };
}
