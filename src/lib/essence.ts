import type { Recipe, RecipeCategory } from "./cookbook";

// Short "Culinary Essence" tagline per recipe, in Hebrew.
const ESSENCE_BY_ID: Record<string, string> = {
  "classic-tomato": "הלב של הפיצה — טחינה מדויקת ואיזון טעמים.",
  "cream-sauce": "מרקם משי — בסיס חלק לפיצות הלבנות שלנו.",
  "san-marzano": "טחינה קצרה לפירוק גושים בלבד — שומרים על המרקם.",
  "rose-sauce": "איזון בין חומציות לשמנת — ערבוב מדויק ביחס.",
  "aioli-garlic-confit": "אמולסיה עשירה על בסיס שום קונפי ביתי.",
  "aioli-mint": "רעננות ירוקה — זילוף איטי לשמירה על הצבע.",
  "aioli-chipotle": "עומק מעושן ופיקנטי — חתימת הטעם שלנו.",
  "aioli-pepperoni": "אומאמי מרוכז — יחס מדויק 1:2.",
  "aioli-mustard": "חדות נקייה — ערבוב פשוט ביחס שווה.",
  pesto: "ירוק חי — שמן זית בזילוף לשמירה על הארומה.",
  "caesar-dressing": "קלאסיקה איטלקית — אנשובי, צלפים ופרמזן.",
  "jam-red-onion": "בישול ארוך ואיטי — מתיקות עמוקה של בצל סגול.",
  "jam-bacon": "ריבת בייקון מעושנת — מלוחה, מתוקה ועשירה.",
  "jam-cherry": "ריבה צמיגה ומבריקה — חומציות פירותית.",
  "jam-pepperoni": "ריבה חריפה בטוויסט — מרקם ריבתי.",
  "garlic-confit-production": "בסיס הקרמים שלנו — בישול ארוך ומדויק.",
  "cacio-e-pepe": "קרם פקורינו ופלפל — קשור בקסנתן ליציבות.",
  "truffle-squeezer": "כמהין רך לזילוף ישיר על הצלחת.",
  "polenta-sticks": "ציפוי כפול — קראנץ' חיצוני, רכות פנימית.",
  "polenta-truffle": "פולנטה חלקה לזילוף משקית.",
  gremolata: "פטרוזיליה, לימון ושום — חיתוך פינאלי לצלחת.",
  croutons: "פוקצ'ה אפויה חלקית, מקוררת ומטוגנת לקראנץ'.",
  cookies: "אפייה מדויקת — 155° למשך 15 דקות בעומק התנור.",
  "kinder-ice-cream": "גלידת קינדר חלבית — שילוב נוטלה למתיקות עשירה.",
  "spice-mix-tomato": "באטץ' של 10 שקיות × 480ג' — סטנדרט קבוע לרוטב אדום.",
  "spice-mix-cream": "באטץ' של 10 שקיות × 620ג' — טחינה למרקם אחיד, סימון X.",
};

const ESSENCE_BY_CATEGORY: Record<RecipeCategory, string> = {
  dishes: "מנה מוגמרת — הרכבה, חימום והגשה לפי סטנדרט פיצה X.",
  sauces_bases: "רוטב בסיס — דיוק בכמויות ובזמני טחינה.",
  aiolis_sauces: "אמולסיה מאוזנת — מרקם חלק וטעם ברור.",
  jams_creams: "בישול ארוך — עומק טעם וצמיגות נכונה.",
  starters: "מנת פתיחה — מרקם וטעם הם הכל.",
  spices: "תערובת תבלינים — שקילה מדויקת לכל שקית.",
  desserts: "סיום מתוק — דיוק באפייה ובקירור.",
  pastas: "פסטה — בישול אל-דנטה ואיחוד עם הרוטב במחבת.",
  authentic_pastas: "פסטה אותנטית — נאמנות למקור הרומאי.",
  salads: "סלט — רעננות, חיתוך אחיד ותיבול מדויק בסוף.",
};

export function essenceFor(recipe: Recipe): string {
  if (recipe.essenceHebrew && recipe.essenceHebrew.trim()) {
    return recipe.essenceHebrew.trim();
  }
  return ESSENCE_BY_ID[recipe.id] ?? ESSENCE_BY_CATEGORY[recipe.category];
}
