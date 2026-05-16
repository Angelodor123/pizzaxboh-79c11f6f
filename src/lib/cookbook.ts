export type RecipeCategory =
  | "sauces_bases"
  | "aiolis_sauces"
  | "jams_creams"
  | "starters"
  | "spices"
  | "desserts";

export interface Ingredient {
  name: string;
  quantity: number;
  unit: string;
  currentUnitPrice?: number;
}

export interface SpiceBag {
  name: string;
  totalWeightGrams: number;
  items: Ingredient[];
}

export interface Recipe {
  id: string;
  category: RecipeCategory;
  nameHebrew: string;
  baseYieldHebrew: string;
  essenceHebrew?: string;
  ingredients: Ingredient[];
  spiceBag?: SpiceBag;
  instructionsHebrew: string;
  timerSeconds?: number;
  textureTargetHebrew?: string;
  techniqueNotesHebrew?: string;
  deleted?: boolean;
}

export const categoryLabels: Record<RecipeCategory, string> = {
  sauces_bases: "רטבים ובסיסים",
  aiolis_sauces: "איולי ורטבים",
  jams_creams: "ריבות וקרמים",
  starters: "מנות ראשונות",
  spices: "תבלינים",
  desserts: "קינוחים",
};

export type SpeedTier = "very_fast" | "fast" | "medium" | "slow" | "very_slow";

export interface SpeedInfo {
  tier: SpeedTier;
  label: string;
  shortLabel: string;
  emoji: string;
  className: string;
}

const SPEED_MAP: Record<SpeedTier, Omit<SpeedInfo, "tier">> = {
  very_fast: {
    label: "מהיר מאוד",
    shortLabel: "מהיר מאוד",
    emoji: "⚡",
    className: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40",
  },
  fast: {
    label: "מהיר",
    shortLabel: "מהיר",
    emoji: "🟢",
    className: "bg-jungle/20 text-jungle border-jungle/40",
  },
  medium: {
    label: "בינוני",
    shortLabel: "בינוני",
    emoji: "🟡",
    className: "bg-amber-brand/15 text-amber-brand border-amber-brand/40",
  },
  slow: {
    label: "איטי",
    shortLabel: "איטי",
    emoji: "🟠",
    className: "bg-orange-500/15 text-orange-300 border-orange-500/40",
  },
  very_slow: {
    label: "איטי מאוד",
    shortLabel: "איטי מאוד",
    emoji: "🔴",
    className: "bg-rose-500/15 text-rose-300 border-rose-500/40",
  },
};

// Heuristic score: timer + complexity proxy (ingredients + spice bag + instructions length).
export function getRecipeSpeed(recipe: Recipe): SpeedInfo {
  const timerMin = (recipe.timerSeconds ?? 0) / 60;
  const ingCount = recipe.ingredients.length + (recipe.spiceBag?.items.length ?? 0);
  const instrLen = recipe.instructionsHebrew.length;
  // Effective minutes proxy
  const score = timerMin + ingCount * 1.5 + instrLen / 80;

  let tier: SpeedTier;
  if (score < 6) tier = "very_fast";
  else if (score < 15) tier = "fast";
  else if (score < 40) tier = "medium";
  else if (score < 120) tier = "slow";
  else tier = "very_slow";

  return { tier, ...SPEED_MAP[tier] };
}

export const categoryOrder: RecipeCategory[] = [
  "sauces_bases",
  "aiolis_sauces",
  "jams_creams",
  "starters",
  "spices",
  "desserts",
];

export const pizzaXCookbook: Recipe[] = [
  {
    id: "classic-tomato",
    category: "sauces_bases",
    nameHebrew: "רוטב עגבניות קלאסי",
    baseYieldHebrew: "קופסה אחת (4 פחיות)",
    ingredients: [
      { name: "עגבניות PELATI (1 ק\"ג כל אחת)", quantity: 4, unit: "פחיות" },
      { name: "בזיליקום טרי", quantity: 1, unit: "חופן" },
    ],
    spiceBag: {
      name: "שקית תבלינים לרוטב עגבניות",
      totalWeightGrams: 480,
      items: [
        { name: "סוכר", quantity: 200, unit: "גרם" },
        { name: "מלח", quantity: 160, unit: "גרם" },
        { name: "שום גבישי", quantity: 120, unit: "גרם" },
      ],
    },
    instructionsHebrew:
      "1. פורקים את 4 הפחיות לפיילה גדולה.\n2. מוסיפים את שקית התבלינים המלאה (480 גרם) ואת חופן הבזיליקום הטרי.\n3. טוחנים עם בלנדר מוט גדול למשך 2.5 דקות בדיוק — לא פחות ולא יותר, כדי לקבל מרקם אחיד עם נוכחות עדינה של עגבנייה.\n4. מעבירים לקופסה אטומה ומסמנים תאריך.",
    timerSeconds: 150,
  },
  {
    id: "cream-sauce",
    category: "sauces_bases",
    nameHebrew: "רוטב שמנת",
    baseYieldHebrew: "2 בקבוקים של 5 ליטר",
    ingredients: [
      { name: "שמנת לבישול 'פקק צהוב'", quantity: 10, unit: "ליטר" },
      { name: "שום קונפי", quantity: 40, unit: "גרם" },
    ],
    spiceBag: {
      name: "שקית תבלינים לרוטב שמנת (סימון X)",
      totalWeightGrams: 620,
      items: [
        { name: "סוכר", quantity: 260, unit: "גרם" },
        { name: "מלח", quantity: 200, unit: "גרם" },
        { name: "שום גבישי", quantity: 160, unit: "גרם" },
      ],
    },
    instructionsHebrew:
      "1. שופכים את 10 ליטר השמנת לכלי ערבוב גדול.\n2. מוסיפים את שקית התבלינים המלאה (620 גרם, סימון X) ואת 40 גרם השום הקונפי.\n3. מערבבים במטרפה או בבלנדר מוט עד שהתבלינים נמסים לחלוטין ומקבלים מרקם משי חלק וברק אחיד — בלי גבישים בתחתית.\n4. מעבירים לשני בקבוקי 5 ליטר ומסננים אם צריך.",
    textureTargetHebrew: "מרקם משי",
  },
  {
    id: "san-marzano",
    category: "sauces_bases",
    nameHebrew: "רוטב עגבניות סן מרזנו",
    baseYieldHebrew: "באטץ' בסיס",
    ingredients: [
      { name: "פחיות סן מרזנו", quantity: 4, unit: "פחיות" },
      { name: "מלח פלור דה סול", quantity: 160, unit: "גרם" },
    ],
    instructionsHebrew:
      "1. פורקים את 4 פחיות הסן מרזנו לפיילה.\n2. מפזרים מעל 160 גרם מלח פלור דה סול.\n3. טוחנים בבלנדר מוט למשך 30 שניות בלבד — המטרה לפרק גושים, לא לרסק. שומרים על מרקם פלפלי של עגבנייה.",
    timerSeconds: 30,
  },
  {
    id: "rose-sauce",
    category: "sauces_bases",
    nameHebrew: "רוטב רוזה",
    baseYieldHebrew: "1.4 ק\"ג רוטב מוכן",
    ingredients: [
      { name: "רוטב עגבניות קלאסי מוכן", quantity: 1, unit: "ק\"ג" },
      { name: "רוטב שמנת מוכן", quantity: 0.4, unit: "ק\"ג" },
    ],
    instructionsHebrew:
      "1. שוקלים 1 ק\"ג רוטב עגבניות קלאסי מוכן.\n2. מוסיפים בדיוק 400 גרם רוטב שמנת מוכן (יחס 1:0.4).\n3. מערבבים בעדינות במטרפה עד שהצבע אחיד וורדרד וללא פסים לבנים. לא לטחון מחדש.",
  },
  {
    id: "aioli-garlic-confit",
    category: "aiolis_sauces",
    nameHebrew: "איולי שום קונפי (פי 2)",
    baseYieldHebrew: "באטץ' כפול",
    ingredients: [
      { name: "מיונז", quantity: 2, unit: "ק\"ג" },
      { name: "שיני שום", quantity: 100, unit: "גרם" },
      { name: "שום קונפי", quantity: 100, unit: "גרם" },
      { name: "מיץ לימון", quantity: 160, unit: "גרם" },
      { name: "דבש", quantity: 48, unit: "גרם" },
      { name: "מלח", quantity: 16, unit: "גרם" },
      { name: "פלפל שחור", quantity: 16, unit: "גרם" },
      { name: "חרדל חלק", quantity: 40, unit: "גרם" },
    ],
    instructionsHebrew:
      "1. מכניסים את כל המרכיבים לקערת המג'ימיקס: מיונז, שיני שום, שום קונפי, מיץ לימון, דבש, מלח, פלפל וחרדל.\n2. מפעילים במהירות גבוהה למשך 5 דקות רצופות עד שכל גושי השום נטחנים והרוטב מקבל גוון אחיד וברק.\n3. מעבירים לסקוויזר או לקופסה אטומה, מסמנים תאריך ושומרים בקירור.",
    timerSeconds: 300,
  },
  {
    id: "aioli-mint",
    category: "aiolis_sauces",
    nameHebrew: "איולי נענע (פי 2)",
    baseYieldHebrew: "באטץ' כפול",
    ingredients: [
      { name: "מיונז", quantity: 2, unit: "ק\"ג" },
      { name: "מלח", quantity: 27, unit: "גרם" },
      { name: "מיץ לימון סחוט", quantity: 150, unit: "גרם" },
      { name: "גרידת לימון", quantity: 3, unit: "יחידות" },
      { name: "שיני שום", quantity: 5, unit: "יחידות" },
      { name: "דבש", quantity: 40, unit: "גרם" },
      { name: "שקית נענע", quantity: 1, unit: "שקית" },
      { name: "כוסברה", quantity: 100, unit: "גרם" },
    ],
    instructionsHebrew:
      "טחינה של 10 דקות של כל המרכיבים למעט הירוקים. לאחר מכן, להוסיף את שקית הנענע והכוסברה בזילוף איטי.",
    techniqueNotesHebrew: "זילוף איטי לירוקים בסוף",
    timerSeconds: 600,
  },
  {
    id: "aioli-chipotle",
    category: "aiolis_sauces",
    nameHebrew: "איולי צ'יפוטלה (פי 3)",
    baseYieldHebrew: "באטץ' משולש",
    ingredients: [
      { name: "מיונז", quantity: 1.5, unit: "ק\"ג" },
      { name: "צ'יפוטלה (עם הרוטב)", quantity: 720, unit: "גרם" },
      { name: "שום קונפי", quantity: 150, unit: "מ\"ל" },
      { name: "מיץ לימון", quantity: 150, unit: "מ\"ל" },
      { name: "גרידת לימון", quantity: 1.5, unit: "יחידות" },
      { name: "דבש", quantity: 36, unit: "גרם" },
      { name: "פפריקה מעושנת", quantity: 36, unit: "גרם" },
      { name: "מלח", quantity: 12, unit: "גרם" },
      { name: "פלפל שחור", quantity: 12, unit: "גרם" },
    ],
    instructionsHebrew: "טחינה במג'ימיקס למשך 5 דקות.",
    timerSeconds: 300,
  },
  {
    id: "aioli-pepperoni",
    category: "aiolis_sauces",
    nameHebrew: "איולי פפרוני (יחס 1:2)",
    baseYieldHebrew: "לפי משקל פפרוני מוכן",
    ingredients: [
      { name: "פפרוני צלוי וטחון (ללא שומן)", quantity: 1, unit: "גרם" },
      { name: "איולי צ'יפוטלה", quantity: 2, unit: "גרם" },
    ],
    instructionsHebrew:
      "על כל 1 גרם של פפרוני צלוי וטחון (ללא שומן), מוסיפים 2 גרם איולי צ'יפוטלה ומערבבים היטב.",
  },
  {
    id: "aioli-mustard",
    category: "aiolis_sauces",
    nameHebrew: "איולי חרדל (50/50)",
    baseYieldHebrew: "יחס שווה",
    ingredients: [
      { name: "איולי שום מוכן", quantity: 250, unit: "גרם" },
      { name: "חרדל חלק", quantity: 250, unit: "גרם" },
    ],
    instructionsHebrew: "ערבוב שווה של שני הרכיבים עד לאחידות מלאה.",
  },
  {
    id: "pesto",
    category: "aiolis_sauces",
    nameHebrew: "פסטו",
    baseYieldHebrew: "באטץ' בסיס",
    ingredients: [
      { name: "בזיליקום", quantity: 1.5, unit: "ק\"ג" },
      { name: "שמן קנולה", quantity: 1.2, unit: "ק\"ג" },
      { name: "שמן זית", quantity: 900, unit: "גרם" },
      { name: "מלח", quantity: 35, unit: "גרם" },
      { name: "שום גבישי", quantity: 35, unit: "גרם" },
    ],
    instructionsHebrew:
      "טוחנים את המרכיבים, כאשר את שמן הזית מוסיפים בזילוף בסוף התהליך.",
    techniqueNotesHebrew: "שמן זית בזילוף בסוף",
  },
  {
    id: "caesar-dressing",
    category: "aiolis_sauces",
    nameHebrew: "רוטב קיסר",
    baseYieldHebrew: "באטץ' בסיס",
    ingredients: [
      { name: "מיונז", quantity: 450, unit: "גרם" },
      { name: "חרדל גרגירים", quantity: 60, unit: "גרם" },
      { name: "אנשובי", quantity: 100, unit: "גרם" },
      { name: "צלפים", quantity: 100, unit: "גרם" },
      { name: "קרם שום קונפי", quantity: 30, unit: "גרם" },
      { name: "מיץ לימון", quantity: 70, unit: "גרם" },
      { name: "דבש", quantity: 35, unit: "גרם" },
      { name: "בלסמי", quantity: 40, unit: "גרם" },
      { name: "שמן זית", quantity: 45, unit: "גרם" },
      { name: "פרמזן", quantity: 70, unit: "גרם" },
    ],
    instructionsHebrew: "איחוד וטחינה של כל הרכיבים למרקם חלק ואחיד.",
  },
  {
    id: "jam-red-onion",
    category: "jams_creams",
    nameHebrew: "ריבת בצל סגול",
    baseYieldHebrew: "בישול ארוך",
    ingredients: [
      { name: "בצל סגול חתוך", quantity: 10, unit: "ק\"ג" },
      { name: "סוכר", quantity: 6, unit: "ק\"ג" },
      { name: "מים", quantity: 13.3, unit: "ק\"ג" },
    ],
    instructionsHebrew:
      "בישול ארוך ואיטי של 8 עד 14 שעות. להיזהר שלא יישרף בתחתית.",
    techniqueNotesHebrew: "להיזהר שלא יישרף בתחתית, בישול 8-14 שעות",
  },
  {
    id: "jam-bacon",
    category: "jams_creams",
    nameHebrew: "ריבת בייקון",
    baseYieldHebrew: "בישול ארוך",
    ingredients: [
      { name: "בצל לבן קצוץ", quantity: 5, unit: "ק\"ג" },
      { name: "בייקון קצוץ", quantity: 3.5, unit: "ק\"ג" },
      { name: "סוכר", quantity: 4, unit: "ק\"ג" },
      { name: "מים", quantity: 4, unit: "ק\"ג" },
    ],
    instructionsHebrew: "בישול איטי של 8 עד 14 שעות למרקם ריבתי עמוק.",
  },
  {
    id: "jam-cherry",
    category: "jams_creams",
    nameHebrew: "ריבת שרי",
    baseYieldHebrew: "בישול ארוך",
    ingredients: [
      { name: "שרי שלמות", quantity: 4, unit: "ק\"ג" },
      { name: "סוכר", quantity: 2, unit: "ק\"ג" },
      { name: "מים", quantity: 4, unit: "ק\"ג" },
    ],
    instructionsHebrew: "בישול ארוך ואיטי (8-14 שעות) עד לצמצום וקבלת מרקם ריבה.",
  },
  {
    id: "jam-pepperoni",
    category: "jams_creams",
    nameHebrew: "ריבת פפרוני (פי 3)",
    baseYieldHebrew: "באטץ' משולש",
    ingredients: [
      { name: "ריבת שרי", quantity: 450, unit: "גרם" },
      { name: "פפרוני צלוי וטחון (ללא שומן)", quantity: 300, unit: "גרם" },
    ],
    instructionsHebrew:
      "פתיחת 450 גרם ריבת שרי עם שומן פפרוני ומים, הוספת 300 גרם פפרוני צלוי וטחון (ללא שומן) ובישול למרקם ריבתי.",
    textureTargetHebrew: "מרקם ריבתי",
  },
  {
    id: "garlic-confit-production",
    category: "jams_creams",
    nameHebrew: "שום קונפי",
    baseYieldHebrew: "5 ק\"ג בסיס",
    ingredients: [
      { name: "שום קלוף", quantity: 5, unit: "ק\"ג" },
      { name: "שמן ארטישוק (השלמה עם סויה)", quantity: 2.5, unit: "ליטר" },
      { name: "מלח", quantity: 75, unit: "גרם" },
      { name: "חרדל חלק", quantity: 50, unit: "גרם" },
    ],
    instructionsHebrew:
      "בישול ב-110 מעלות עד בעבוע ראשוני, הורדה ל-90 מעלות לשעתיים. הוספת מלח וחרדל. מסננים שמן, טוחנים את השום במג'ימיקס ופותחים חזרה עם השמן בזרם דק עד לקבלת קרם יציב.",
    textureTargetHebrew: "קרם יציב",
  },
  {
    id: "polenta-sticks",
    category: "starters",
    nameHebrew: "אצבעות פולנטה",
    baseYieldHebrew: "באטץ' בסיס",
    ingredients: [
      { name: "חלב", quantity: 500, unit: "גרם" },
      { name: "מים", quantity: 350, unit: "גרם" },
      { name: "שמנת", quantity: 125, unit: "גרם" },
      { name: "קמח תירס", quantity: 130, unit: "גרם" },
      { name: "גבינה", quantity: 250, unit: "גרם" },
      { name: "מלח", quantity: 10, unit: "גרם" },
    ],
    instructionsHebrew:
      "לאחר קיפאון עמוק, חובה לבצע ציפוי כפול (קמח-ביצה-פירורים X2).",
    techniqueNotesHebrew: "חובה ציפוי כפול (קמח-ביצה-פירורים X2) לאחר קיפאון עמוק",
  },
  {
    id: "polenta-truffle",
    category: "starters",
    nameHebrew: "פולנטה כמהין (לזילוף)",
    baseYieldHebrew: "באטץ' לזילוף",
    ingredients: [
      { name: "חלב", quantity: 500, unit: "גרם" },
      { name: "מים", quantity: 500, unit: "גרם" },
      { name: "שמנת", quantity: 125, unit: "גרם" },
      { name: "קמח תירס", quantity: 130, unit: "גרם" },
      { name: "חמאה קרה", quantity: 30, unit: "גרם" },
      { name: "כמהין", quantity: 30, unit: "גרם" },
      { name: "פרמז'ן", quantity: 30, unit: "גרם" },
      { name: "מלח", quantity: 10, unit: "גרם" },
    ],
    instructionsHebrew:
      "בישול הפולנטה ואיחוד הרכיבים עד לקבלת מרקם חלק המתאים לזילוף משקית.",
  },
  {
    id: "cacio-e-pepe",
    category: "jams_creams",
    nameHebrew: "קרם קאצ'יאו אה פפה",
    baseYieldHebrew: "באטץ' בסיס",
    ingredients: [
      { name: "פקורינו רומנו", quantity: 500, unit: "גרם" },
      { name: "מים", quantity: 400, unit: "מ\"ל" },
      { name: "רוטב שמנת מוכן", quantity: 50, unit: "מ\"ל" },
      { name: "שמן זית", quantity: 50, unit: "מ\"ל" },
      { name: "פלפל שחור קלוי", quantity: 20, unit: "גרם" },
      { name: "קסנתן גאם", quantity: 0.5, unit: "גרם" },
    ],
    instructionsHebrew:
      "טחינה ואיחוד של כל הרכיבים יחד עם הקסנתן גאם לקבלת קרם קשור ויציב.",
  },
  {
    id: "truffle-squeezer",
    category: "jams_creams",
    nameHebrew: "שמנת כמהין",
    baseYieldHebrew: "בקבוק לחיץ (סקוויזר)",
    ingredients: [
      { name: "מחית כמהין", quantity: 200, unit: "גרם" },
      { name: "שמנת", quantity: 700, unit: "גרם" },
    ],
    instructionsHebrew: "ערבוב אחיד של מחית הכמהין והשמנת ומילוי בקבוק סקוויזר.",
  },
  {
    id: "cookies",
    category: "desserts",
    nameHebrew: "עוגיות",
    baseYieldHebrew: "11 יחידות למגש",
    ingredients: [{ name: "בצק עוגיות מנותב", quantity: 11, unit: "יחידות" }],
    instructionsHebrew:
      "סידור של 11 יחידות למגש (בלי נייר אפייה). אפייה ב-155 מעלות למשך 15 דקות בחלק העמוק של התנור. קירור מוחלט לפני אחסון.",
    techniqueNotesHebrew:
      "בלי נייר אפייה, בחלק העמוק של התנור. קירור מוחלט לפני אחסון.",
    timerSeconds: 900,
  },
  {
    id: "croutons",
    category: "starters",
    nameHebrew: "קרוטונים",
    baseYieldHebrew: "באטץ'",
    ingredients: [{ name: "פוקצ'ה אפויה חלקית (רכה)", quantity: 1, unit: "יחידה" }],
    instructionsHebrew:
      "אפייה חלקית של הפוקצ'ה, קירור של שעתיים (סטאפ לבצק), חיתוך וטיגון עמוק.",
    techniqueNotesHebrew: "קירור של שעתיים (סטאפ לבצק) לפני חיתוך וטיגון",
  },
  {
    id: "kinder-ice-cream",
    category: "desserts",
    nameHebrew: "גלידה קינדר",
    baseYieldHebrew: "מיכל גלידה גדול",
    ingredients: [
      { name: "שקית פורמולה 2.2", quantity: 1, unit: "שקית" },
      { name: "חלב", quantity: 7.5, unit: "ליטר" },
      { name: "שמנת", quantity: 400, unit: "גרם" },
      { name: "קינדר", quantity: 800, unit: "גרם" },
      { name: "נוטלה", quantity: 200, unit: "גרם" },
      { name: "מלח", quantity: 20, unit: "גרם" },
    ],
    instructionsHebrew: "איחוד, טחינה והעברה למכונת גלידה לפי הנהלים.",
  },
  {
    id: "gremolata",
    category: "starters",
    nameHebrew: "גרמולטה",
    baseYieldHebrew: "באטץ' בסיס",
    ingredients: [
      { name: "פטרוזיליה", quantity: 60, unit: "גרם" },
      { name: "גרידת לימון", quantity: 1, unit: "יחידה" },
      { name: "שום", quantity: 5, unit: "גרם" },
      { name: "מלח", quantity: 4, unit: "גרם" },
      { name: "שמן זית", quantity: 50, unit: "גרם" },
    ],
    instructionsHebrew: "טחינה למרקם חלק.",
    textureTargetHebrew: "מרקם חלק",
  },
  {
    id: "spice-mix-tomato",
    category: "spices",
    nameHebrew: "ייצור שקיות תבלין - רוטב אדום",
    baseYieldHebrew: '10 שקיות של 480 גרם (סה״כ 4.8 ק"ג)',
    ingredients: [
      { name: "סוכר", quantity: 2000, unit: "גרם" },
      { name: "מלח", quantity: 1600, unit: "גרם" },
      { name: "שום גבישי", quantity: 1200, unit: "גרם" },
    ],
    instructionsHebrew:
      "ערבוב יבש של כל המרכיבים וחלוקה ל-10 שקיות שוות של 480 גרם כל אחת. כל שקית מיועדת לפיילה של 4 פחיות עגבניות.",
    techniqueNotesHebrew: "10 שקיות × 480 גרם — שקית אחת לפיילה של 4 פחיות",
  },
  {
    id: "spice-mix-cream",
    category: "spices",
    nameHebrew: "ייצור שקיות תבלין - רוטב לבן",
    baseYieldHebrew: '10 שקיות של 620 גרם (סה״כ 6.2 ק"ג)',
    ingredients: [
      { name: "סוכר", quantity: 2600, unit: "גרם" },
      { name: "מלח", quantity: 2000, unit: "גרם" },
      { name: "שום גבישי", quantity: 1600, unit: "גרם" },
    ],
    instructionsHebrew:
      "ערבוב וטחינה של המרכיבים למשך 30 שניות עד לקבלת מרקם אחיד. חלוקה ל-10 שקיות שוות של 620 גרם כל אחת.",
    timerSeconds: 30,
    techniqueNotesHebrew: "סימון X חובה על כל שקית — לרוטב שמנת בלבד",
  },
];