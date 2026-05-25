export type RecipeCategory =
  | "dishes"
  | "sauces_bases"
  | "aiolis_sauces"
  | "jams_creams"
  | "starters"
  | "spices"
  | "croutons"
  | "desserts"
  | "pastas"
  | "authentic_pastas"
  | "salads";


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
  shelfLifeHebrew?: string;
  deleted?: boolean;
}

export const DEFAULT_SHELF_LIFE = "תוקף: לפי נוהל מטבח כללי";

export const categoryLabels: Record<RecipeCategory, string> = {
  dishes: "מנות",
  sauces_bases: "רטבים ובסיסים",
  aiolis_sauces: "איולי ורטבים",
  jams_creams: "ריבות וקרמים",
  starters: "מנות ראשונות",
  spices: "תבלינים",
  croutons: "קרוטונים ותוספות",
  desserts: "קינוחים",
  pastas: "פסטות",
  authentic_pastas: "פסטות אותנטיות",
  salads: "סלטים",
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

// Estimates total end-to-end minutes by combining explicit timerSeconds with
// duration mentions in instructions / notes / yield ("8-14 שעות", "שעתיים",
// "שעה", "דקות"). Falls back to a small complexity proxy when no time is found.
function extractDurationMinutes(text: string): number {
  if (!text) return 0;
  let max = 0;
  // ranges like "8-14 שעות" — take the upper bound
  for (const m of text.matchAll(/(\d+(?:\.\d+)?)\s*[-–—]\s*(\d+(?:\.\d+)?)\s*שעות/g)) {
    max = Math.max(max, parseFloat(m[2]) * 60);
  }
  for (const m of text.matchAll(/(\d+(?:\.\d+)?)\s*שעות/g)) {
    max = Math.max(max, parseFloat(m[1]) * 60);
  }
  if (/שעתיים/.test(text)) max = Math.max(max, 120);
  if (/\bשעה\b/.test(text)) max = Math.max(max, 60);
  // ranges like "5-7 דקות" — take the upper bound
  for (const m of text.matchAll(/(\d+(?:\.\d+)?)\s*[-–—]\s*(\d+(?:\.\d+)?)\s*דקות/g)) {
    max = Math.max(max, parseFloat(m[2]));
  }
  for (const m of text.matchAll(/(\d+(?:\.\d+)?)\s*דקות/g)) {
    max = Math.max(max, parseFloat(m[1]));
  }
  return max;
}

export function getRecipeSpeed(recipe: Recipe): SpeedInfo {
  const timerMin = (recipe.timerSeconds ?? 0) / 60;
  const corpus = [
    recipe.instructionsHebrew,
    recipe.techniqueNotesHebrew ?? "",
    recipe.baseYieldHebrew ?? "",
    recipe.textureTargetHebrew ?? "",
  ].join(" ");
  const durationMin = extractDurationMinutes(corpus);
  const ingCount = recipe.ingredients.length + (recipe.spiceBag?.items.length ?? 0);
  // Total end-to-end time: explicit duration dominates; add small prep proxy.
  const totalMin = Math.max(timerMin, durationMin) + ingCount * 1.5;

  let tier: SpeedTier;
  if (totalMin < 10) tier = "very_fast";
  else if (totalMin < 30) tier = "fast";
  else if (totalMin < 90) tier = "medium";
  else if (totalMin < 300) tier = "slow";
  else tier = "very_slow";

  return { tier, ...SPEED_MAP[tier] };
}

export const categoryOrder: RecipeCategory[] = [
  "dishes",
  "sauces_bases",
  "aiolis_sauces",
  "jams_creams",
  "starters",
  "spices",
  "croutons",
  "desserts",
  "pastas",
  "authentic_pastas",
  "salads",
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
    baseYieldHebrew: "2 קופסאות של 4 ליטר",
    ingredients: [
      { name: "שמנת לבישול 'פקק צהוב' (מיכל 5 ליטר)", quantity: 2, unit: "מיכלים" },
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
      "1. שופכים את שני המיכלים של השמנת (5 ליטר כל אחד) לכלי ערבוב גדול.\n2. מוסיפים את שקית התבלינים המלאה (620 גרם, סימון X) ואת 40 גרם השום הקונפי.\n3. מערבבים במטרפה או בבלנדר מוט עד שהתבלינים נמסים לחלוטין ומתקבל מרקם חלק וברק אחיד — בלי גבישים בתחתית.\n4. מחלקים את הכמות שיוצאת לשתי קופסאות של 4 ליטר ומסננים אם צריך.",
    textureTargetHebrew: "מרקם חלק",
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
      "1. מכניסים למג'ימיקס מיונז, מלח, מיץ לימון, גרידת לימון, שיני שום ודבש.\n2. טוחנים 10 דקות במהירות גבוהה עד שמתקבל בסיס חלק וצהבהב.\n3. תוך כדי טחינה, ב-Slow Stream (זילוף איטי ועדין), מוסיפים את שקית הנענע ואחריה את הכוסברה — כדי לשמור על צבע ירוק חי בלי לחמם את הירוקים.\n4. עוצרים ברגע שהצבע אחיד ומעבירים מיד לסקוויזר קר.",
    techniqueNotesHebrew: "זילוף איטי לירוקים בסוף — כדי לא לחמם ולא להחמיץ את הצבע",
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
    instructionsHebrew:
      "1. מכניסים למג'ימיקס את המיונז, צ'יפוטלה עם הרוטב, שום קונפי, מיץ לימון, גרידת לימון, דבש, פפריקה מעושנת, מלח ופלפל.\n2. טוחנים 5 דקות עד לקבלת רוטב חלק לחלוטין בגוון אדמדם-חום ועם ריח עישון ברור.\n3. טועמים — אם חריף מדי, מאזנים בעוד דבש; אם חלש, מוסיפים כף צ'יפוטלה.",
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
      "1. פורסים פפרוני ומסדרים בתבנית על רשת מעל מגש (כדי שהשומן יטפטף החוצה).\n2. צולים בתנור ב-200°C במשך חצי שעה — עד שהפפרוני מתייבש, מקבל גוון אדום-חום והשומן נפרד לחלוטין.\n3. מסננים את השומן ושומרים אותו בצד (לשימוש בריבת פפרוני).\n4. טוחנים את הפפרוני הצלוי דק במג'ימיקס (ללא השומן).\n5. שוקלים: על כל 1 גרם פפרוני טחון מוסיפים 2 גרם איולי צ'יפוטלה מוכן.\n6. מערבבים היטב לרוטב אחיד וצמיג.",
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
    instructionsHebrew:
      "1. שוקלים 250 גרם איולי שום מוכן ו-250 גרם חרדל חלק (יחס 50/50).\n2. מערבבים במטרפה בקערה עד שהמרקם אחיד לחלוטין וגוון צהוב-קרמי.\n3. מעבירים לסקוויזר ושומרים בקירור.",
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
      "1. מכניסים למג'ימיקס את הבזיליקום, שמן הקנולה, המלח והשום הגבישי.\n2. טוחנים עד שמתקבל מרקם חלק וירוק עמוק.\n3. תוך כדי טחינה, מוסיפים את שמן הזית בזילוף איטי (Slow Stream) — זה שומר על טריות הטעם ועל גוון ירוק חי ולא דהוי.\n4. מעבירים לקופסה אטומה ומכסים בשכבת שמן זית דקה לשמירה.",
    techniqueNotesHebrew: "שמן זית בזילוף בסוף — לטריות וצבע חי",
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
    instructionsHebrew:
      "1. מכניסים למג'ימיקס: אנשובי, צלפים, שום קונפי, מיץ לימון, דבש, בלסמי ופרמזן.\n2. טוחנים עד למחית חלקה.\n3. מוסיפים את המיונז וחרדל הגרגירים, טוחנים שוב עד לאחידות מלאה.\n4. תוך כדי טחינה, מזליפים את שמן הזית בזרם דק לקבלת אמולסיה יציבה.\n5. טועמים ומאזנים מלח/לימון לפי הצורך.",
  },
  {
    id: "jam-red-onion",
    category: "jams_creams",
    nameHebrew: "ריבת בצל סגול",
    baseYieldHebrew: "אפייה ארוכה בתנור",
    ingredients: [
      { name: "בצל סגול חתוך", quantity: 10, unit: "ק\"ג" },
      { name: "סוכר", quantity: 6, unit: "ק\"ג" },
      { name: "מים", quantity: 13.3, unit: "ק\"ג" },
    ],
    instructionsHebrew:
      "1. חותכים את הבצל הסגול לחתיכות אחידות.\n2. מכניסים לגסטרונום עמוק יחד עם הסוכר והמים.\n3. מכניסים לתנור 130-160°C למשך 8-14 שעות — האפייה האיטית מוציאה את המתיקות בלי לשרוף.\n4. מערבבים מדי כמה שעות וגורפים את התחתית והדפנות.\n5. סיום: המרקם ריבתי, סמיך, בגוון סגול-בורדו כהה. הנוזל הצטמצם כמעט לחלוטין.",
    techniqueNotesHebrew: "אפייה איטית בתנור 130-160°C, 8-14 שעות. ערבוב מדי כמה שעות",
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
    instructionsHebrew:
      "1. קוצצים את הבצל הלבן והבייקון לקצוץ אחיד.\n2. בסיר רחב, מתחילים בצליית הבייקון להוצאת השומן וקרמליזציה.\n3. מוסיפים את הבצל הלבן ומאדים יחד עד שהבצל שקוף.\n4. מוסיפים סוכר ומים, מבשלים בלהבה נמוכה 8-14 שעות עד למרקם ריבתי כהה ועמוק.\n5. מערבבים מדי שעה וגורפים את התחתית.",
  },
  {
    id: "jam-cherry",
    category: "jams_creams",
    nameHebrew: "ריבת שרי",
    baseYieldHebrew: "אפייה ארוכה בתנור",
    ingredients: [
      { name: "שרי שלמות", quantity: 4, unit: "ק\"ג" },
      { name: "סוכר", quantity: 2, unit: "ק\"ג" },
      { name: "מים", quantity: 4, unit: "ק\"ג" },
    ],
    instructionsHebrew:
      "1. מכניסים את העגבניות השרי השלמות לגסטרונום עמוק יחד עם הסוכר והמים.\n2. מכניסים לתנור 130-160°C למשך 8-14 שעות — האפייה האיטית מפרקת את השרי לאט ובונה עומק טעם בלי לשרוף.\n3. מערבבים בעדינות מדי כמה שעות כדי לא לרסק את השרי לחלוטין — רוצים נתחים שלמים בתוך הריבה.\n4. מסיימים כשהמרקם דביק, הסירופ אדום-כהה וריבתי.",
    techniqueNotesHebrew: "אפייה בתנור 130-160°C, 8-14 שעות. ערבוב עדין לשמירה על נתחים שלמים",
  },
  {
    id: "jam-pepperoni",
    category: "jams_creams",
    nameHebrew: "ריבת פפרוני (יחס 1.5:1)",
    baseYieldHebrew: "750 גרם ריבת שרי לכל 500 גרם פפרוני",
    ingredients: [
      { name: "ריבת שרי מוכנה", quantity: 750, unit: "גרם" },
      { name: "פפרוני (לפני צליה)", quantity: 500, unit: "גרם" },
    ],
    instructionsHebrew:
      "1. הכנת הפפרוני (זהה לאיולי פפרוני): פורסים פפרוני ומסדרים בתבנית על רשת מעל מגש.\n2. צולים בתנור 200°C למשך חצי שעה — עד שהפפרוני מתייבש והשומן נפרד.\n3. מסננים את השומן ושומרים אותו בצד.\n4. טוחנים את הפפרוני הצלוי דק במג'ימיקס.\n5. בסיר מחממים 750 גרם ריבת שרי מוכנה יחד עם שומן הפפרוני ומעט מים — \"פותחים\" את הריבה למרקם נוזלי-עבה.\n6. מוסיפים את הפפרוני הטחון (500 גרם בסיס, מתקבל פחות אחרי צליה).\n7. מבשלים בלהבה נמוכה תוך ערבוב, עד שהמרקם נקשר ונעשה ריבתי, דביק וצבעו אדום-חום עמוק.",
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
      "1. מסדרים את 5 ק\"ג השום הקלוף בתבנית עמוקה ומכסים בשמן הארטישוק (משלימים בסויה אם חסר).\n2. מכניסים לתנור 110°C עד שמתחיל בעבוע ראשוני בשמן.\n3. מורידים ל-90°C וממשיכים שעתיים — השום צריך להתרכך עד שמתפורר במגע אבל לא להישרף.\n4. מוסיפים את המלח והחרדל ומערבבים בעדינות.\n5. מסננים את השמן ושומרים בצד.\n6. טוחנים את השום במג'ימיקס למחית.\n7. תוך כדי טחינה, מזליפים בחזרה את השמן בזרם דק (Slow Stream) עד לאמולסיה — קרם יציב, מבריק וזהוב.",
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
      "1. בסיר רחב מרתיחים את החלב, המים והשמנת יחד עם המלח.\n2. כשמגיע לרתיחה, יוצקים את קמח התירס בזרם דק תוך טריפה רציפה כדי למנוע גושים.\n3. ממשיכים לבשל בלהבה נמוכה כ-5-7 דקות עד שהפולנטה מתעבה ומתנתקת מדפנות הסיר.\n4. מוסיפים את הגבינה ומערבבים עד התמזגות מלאה.\n5. שופכים לתבנית מרובעת מצופה בשכבה דקה של שמן, מיישרים את הפני הפולנטה ומקררים בקירור עמוק (מקפיא קל) עד התקשות מלאה.\n6. חותכים לאצבעות בגודל אחיד.\n7. ציפוי כפול חובה: קמח → ביצה → פירורים → ביצה → פירורים. שתי שכבות פירורים יוצרות את הקראנץ' החיצוני.\n8. שומרים מצופים במקפיא עד שלב הטיגון.",
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
      "1. מרתיחים בסיר את החלב, המים והשמנת עם המלח.\n2. יוצקים פנימה את קמח התירס בזרם דק תוך טריפה רציפה.\n3. מבשלים בלהבה נמוכה עד למרקם חלק וסמיך.\n4. מורידים מהאש ומוסיפים את החמאה הקרה תוך ערבוב — היא נותנת ברק ומרקם משי (mounter).\n5. מוסיפים את הפרמז'ן ולבסוף את הכמהין הטחון.\n6. מערבבים עד אחידות מלאה — המרקם צריך להיות חלק ונוזלי דיו לזלף משקית אבל מספיק קשור כדי להחזיק צורה.\n7. מעבירים לסקוויזר בעודו חם.",
  },
  {
    id: "cacio-e-pepe",
    category: "jams_creams",
    nameHebrew: "קרם קאצ'יאו אה פפה",
    baseYieldHebrew: "כלי של 4 ליטר",
    ingredients: [
      { name: "פקורינו רומנו", quantity: 500, unit: "גרם" },
      { name: "מים", quantity: 400, unit: "מ\"ל" },
      { name: "רוטב שמנת מוכן", quantity: 50, unit: "מ\"ל" },
      { name: "שמן זית", quantity: 50, unit: "מ\"ל" },
      { name: "פלפל שחור קלוי", quantity: 20, unit: "גרם" },
      { name: "קסנתן גאם", quantity: 0.5, unit: "גרם" },
    ],
    instructionsHebrew:
      "1. קולים את הפלפל השחור במחבת יבשה על אש בינונית כדקה, עד שעולה ריח. לא לשרוף.\n2. בסיר קטן מחממים את המים והשמנת לטמפרטורה של 75-80°C בלבד — לא להרתיח (הרתחה תקריש את הגבינה).\n3. מכניסים את הפקורינו רומנו למג'ימיקס יחד עם הפלפל השחור הקלוי.\n4. מוסיפים את תערובת המים והשמנת למג'ימיקס בהדרגה תוך כדי שהמג'ימיקס פועל, עד שנוצר מרקם קרמי אחיד.\n5. מוסיפים את שמן הזית בזרם דק תוך כדי פעולת המג'ימיקס.\n6. מפזרים את הקסנתן גאם תוך כדי הפעלת הבלנדר במהירות גבוהה למשך 30-40 שניות, עד שהקרם אחיד לחלוטין.\n7. מעבירים לכלי של 4 ליטר, מקררים מהר ושומרים בקירור.",
    techniqueNotesHebrew: "מים+שמנת ב-75-80°C בלבד — לא להרתיח. קסנתן בסוף לייצוב.",
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
    instructionsHebrew:
      "1. שוקלים 200 גרם מחית כמהין ו-700 גרם שמנת לקערה.\n2. מערבבים במטרפה עד מרקם אחיד וגוון בז'-חום עדין, ללא גושי מחית.\n3. מסננים אם צריך וממלאים בקבוק סקוויזר.\n4. שומרים בקירור — לטלטל קלות לפני כל שימוש.",
  },
  {
    id: "cookies",
    category: "desserts",
    nameHebrew: "עוגיות",
    baseYieldHebrew: "11 יחידות למגש",
    ingredients: [{ name: "בצק עוגיות מנותב", quantity: 11, unit: "יחידות" }],
    instructionsHebrew:
      "1. מסדרים בדיוק 11 יחידות של בצק עוגיות מנותב על מגש — בלי נייר אפייה (זה משנה את צורת הפיזור והקראנץ').\n2. מכניסים לחלק העמוק של התנור — הטמפרטורה שם יציבה יותר.\n3. אופים ב-155°C למשך 15 דקות בדיוק.\n4. מוציאים ומקררים על המגש קירור מוחלט — אסור להזיז לפני שהעוגייה התייצבה, אחרת היא תתפורר.\n5. רק לאחר קירור מלא — מעבירים לאחסון אטום.",
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
      "1. אופים את הפוקצ'ה אפייה חלקית בלבד — היא צריכה לצאת רכה ומעט לחה, לא מזהיבה לחלוטין.\n2. מחכים שעה-שעתיים עד שהבצקיל מתקרר לחלוטין וניתן לחתוך נקי.\n3. חותכים לקוביות אחידות.\n4. מסדרים בשכבה אחת על תבנית ומכניסים לתנור 140°C למשך 15-20 דקות — תהליך ייבוש (דהידרציה), לא אפייה. הקוביות צריכות להתייצב ולא להשחים.\n5. מטגנים ב-Deep Fry עד הזהבה אחידה וקראנץ' מלא.\n6. מסננים על נייר סופג ומלחים בעודם חמים.",
    techniqueNotesHebrew: "קירור שעה-שעתיים → חיתוך → ייבוש בתנור 140°C 15-20 דק' → Deep Fry",
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
    instructionsHebrew:
      "1. מערבבים בקערה גדולה את שקית הפורמולה 2.2 עם החלב והשמנת עד שאין גושים.\n2. מוסיפים את הקינדר השבור, הנוטלה והמלח.\n3. טוחנים בבלנדר חזק עד שמתקבל בסיס חלק וקרמי.\n4. מעבירים למכונת הגלידה ומפעילים לפי הנהלים עד שהמרקם מקפיא לקרמי-יציב.\n5. מעבירים למיכל אטום ומאחסנים במקפיא.",
  },
  {
    id: "cauliflower",
    category: "starters",
    nameHebrew: "כרובית",
    baseYieldHebrew: "מנה של 510 גרם (550 גרם גלם למנה ל-48 שעות)",
    ingredients: [
      { name: "כרובית שלמה", quantity: 550, unit: "גרם (\u00d7מס' מנות)" },
      { name: "מים (לאידוי)", quantity: 1, unit: "נגיעה בתחתית" },
    ],
    instructionsHebrew:
      "🍳 ציוד וסביבה: מחבת יצוקה, נייר כסף, תנור 400°C, 2 סקרינים להפרדה מאבן התנור, צ'יפסר (Deep Fry).\n\n👨‍🍳 שלב א' — בישול ארוך (Prep):\n1. מניחים את הכרובית במחבת יצוקה עם נגיעה של מים בתחתית — קריטי, המים מייצרים תהליך אידוי בתוך המחבת.\n2. אוטמים את המחבת עם נייר כסף בצורה הרמטית לחלוטין (כדי שהאדים לא יברחו).\n3. מכניסים לתנור 400°C על גבי שני סקרינים (חובה למניעת מגע ישיר עם אבן התנור).\n4. זמן בישול: 60 דקות בדיוק.\n\n⚖️ שלב ב' — מנות:\n5. מוציאים מהתנור ושוקלים מיד למנות אחידות של 510 גרם ליחידה.\n\n🍟 שלב ג' — סגירה בסרוויס:\n6. טיגון ב-Deep Fry (צ'יפסר) למשך 2.5 דקות בדיוק.",
    techniqueNotesHebrew: "מים בתחתית המחבת + איטום הרמטי בנייר כסף = אידוי בתנור. שני סקרינים חובה. מנה 510 גרם, טיגון סופי 2.5 דק'.",
    timerSeconds: 3600,
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
    instructionsHebrew:
      "1. שוטפים ומייבשים את הפטרוזיליה היטב — מים יקלקלו את האמולסיה.\n2. מכניסים למג'ימיקס: פטרוזיליה, גרידת הלימון, השום והמלח.\n3. טוחנים תוך זילוף שמן הזית בזרם דק עד למרקם חלק, ירוק זוהר ועוצמתי.\n4. מעבירים לגסטרונום קטן ושומרים בקירור — לצרוך תוך 48 שעות לטריות מקסימלית.",
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
      "1. שוקלים את כל המרכיבים יחד לפיילה נקייה ויבשה: 2000 גרם סוכר, 1600 גרם מלח, 1200 גרם שום גבישי (סה\"כ 4800 גרם).\n2. מערבבים יבש היטב עד תערובת אחידה לחלוטין בלי כיסי מלח/סוכר.\n3. מחלקים בדיוק ל-10 שקיות נפרדות, 480 גרם בכל שקית — חובה לשקול כל שקית בנפרד.\n4. סוגרים, מסמנים תאריך, ושומרים יבש. כל שקית מיועדת לפיילה אחת של 4 פחיות עגבניות.",
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
      "1. שוקלים יחד לפיילה: 2600 גרם סוכר, 2000 גרם מלח, 1600 גרם שום גבישי (סה\"כ 6200 גרם).\n2. מחלקים בדיוק ל-10 שקיות, 620 גרם בכל שקית.\n3. חובה לסמן X על כל שקית — זו ההבחנה הקריטית מול שקיות הרוטב האדום, ערבוב יוביל לרוטב מקולקל.\n4. סוגרים, מסמנים תאריך, שומרים יבש.",
    techniqueNotesHebrew: "סימון X חובה על כל שקית — לרוטב שמנת בלבד",
  },
];