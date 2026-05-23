// Pizza X public menu categories (mirroring Tabit/Wolt order page).
// Used to filter "dishes" (מנות) by their position on the customer-facing menu,
// independent of the back-of-house recipe-book categories.

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
