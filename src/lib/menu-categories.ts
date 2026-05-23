// Pizza X public menu categories (mirroring Tabit/Wolt order page).
// Used to filter "dishes" (מנות) by their position on the customer-facing menu,
// independent of the back-of-house recipe-book categories.

import type { Recipe, RecipeCategory } from "./cookbook";


export type MenuCategory =
  | "starters"
  | "pizza_tomato"
  | "pizza_cream"
  | "pizza_rose"
  | "specials"
  | "dips"
  | "pastas"
  | "salads"
  | "desserts"
  | "drinks"
  | "other";

export const menuCategoryLabels: Record<MenuCategory, string> = {
  starters: "ראשונות",
  pizza_tomato: "פיצות רוטב עגבניות",
  pizza_cream: "פיצות שמנת שום קונפי",
  pizza_rose: "פיצות רוטב רוזה",
  specials: "המיוחדים שלנו",
  dips: "דיפים",
  pastas: "פסטות",
  salads: "סלטים",
  desserts: "קינוחים",
  drinks: "שתיה קלה",
  other: "אחר",
};

export const menuCategoryEmoji: Record<MenuCategory, string> = {
  starters: "🥖",
  pizza_tomato: "🍅",
  pizza_cream: "🥛",
  pizza_rose: "🌸",
  specials: "⭐",
  dips: "🥣",
  pastas: "🍝",
  salads: "🥗",
  desserts: "🍰",
  drinks: "🥤",
  other: "🍽️",
};

export const menuCategoryOrder: MenuCategory[] = [
  "starters",
  "pizza_tomato",
  "pizza_cream",
  "pizza_rose",
  "specials",
  "dips",
  "pastas",
  "salads",
  "desserts",
  "drinks",
  "other",
];

/**
 * Heuristic classification of a dish into a public menu category, based on its
 * Hebrew name. Used as a fallback when a dish has not been tagged explicitly.
 */
export function inferMenuCategory(name: string): MenuCategory {
  const n = name || "";
  // Desserts — sweet keywords
  if (/(קינוח|עוגיה|עוגייה|עוגות|עוגה|גלידה|נוטלה|קינדר|טירמיסו|פאי|טארט|נוצ['׳]ולה|שוקולד|מאפ)/.test(n)) {
    return "desserts";
  }
  if (/(שתיה|שתייה|קולה|מיץ|סודה|מים|בירה|יין|קוקטייל|אספרסו|קפה|לימונדה)/.test(n)) {
    return "drinks";
  }
  if (/(סלט|רוקט|קיסר|קפרזה)/.test(n)) return "salads";
  if (/(פסטה|פפרדלה|טליאטלה|קסיו|קצ['׳]יו|רביולי|ניוקי|לזניה|אפיון|קרבונרה|אלפרדו)/.test(n)) {
    return "pastas";
  }
  if (/(דיפ|טבילה|חומוס|לאבנה|פוקאצ['׳]ה|פוקצ['׳]ה|לחם|פיתה)/.test(n)) return "dips";
  // Pizza variants
  if (/(פיצה|מרגריטה|מרקריטה|פפרוני|פונגי|פטריות|רוזה)/.test(n)) {
    if (/(רוזה)/.test(n)) return "pizza_rose";
    if (/(שמנת|לבנ|קונפי|טרטופו|כמהין)/.test(n)) return "pizza_cream";
    return "pizza_tomato";
  }
  if (/(מיוחד|ספיישל|שף)/.test(n)) return "specials";
  if (/(ראשונ|מתאבן|פתיח|אצבע|קרוקט|ארנצ|בסקט)/.test(n)) return "starters";
  return "other";
}

/**
 * Recipe categories that represent customer-facing menu items ("דף המנות").
 * Everything else is back-of-house / "דף המתכונים" (sauces, bases, spices, etc.).
 */
export const MENU_ITEM_CATEGORIES: ReadonlyArray<RecipeCategory> = [
  "dishes",
  "starters",
  "desserts",
  "pastas",
  "authentic_pastas",
  "salads",
];

export const BACK_OF_HOUSE_CATEGORIES: ReadonlyArray<RecipeCategory> = [
  "sauces_bases",
  "aiolis_sauces",
  "jams_creams",
  "spices",
  "croutons",
];


export function isMenuItem(recipe: Pick<Recipe, "category">): boolean {
  return MENU_ITEM_CATEGORIES.includes(recipe.category);
}

/**
 * Map a recipe to the public-menu category. Recipes already tagged with a
 * menu-aligned category (starters/desserts/pastas/salads) map directly;
 * generic "dishes" fall back to name-based inference.
 */
export function recipeToMenuCategory(recipe: Pick<Recipe, "category" | "nameHebrew">): MenuCategory {
  switch (recipe.category) {
    case "starters":
      return "starters";
    case "desserts":
      return "desserts";
    case "pastas":
    case "authentic_pastas":
      return "pastas";
    case "salads":
      return "salads";
    case "dishes":
      return inferMenuCategory(recipe.nameHebrew);
    default:
      return "other";
  }
}
