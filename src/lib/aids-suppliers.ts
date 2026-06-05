// Static catalog of supplier ordering standards (תקנים) for the "עזרים" view.
// Two table shapes:
//  - "static":     columns = שם מוצר, כמות יעד
//  - "split_days": columns = שם מוצר + per-day amounts (e.g. ראשון / רביעי)

export type StaticItem = { item: string; amount: string | number };
export type SplitDays = Record<string, StaticItem[]>;

export type SupplierAid =
  | {
      supplier: string;
      category?: string;
      type: "static";
      callout?: string;
      items: StaticItem[];
    }
  | {
      supplier: string;
      category?: string;
      type: "split_days";
      callout?: string;
      days: SplitDays;
    };

export const SUPPLIER_AIDS: SupplierAid[] = [
  {
    supplier: "אנשי הזית",
    category: "שמן זית וחומרי גלם",
    type: "static",
    callout: "אספקה: יום שני · דדליין הזמנה: יום ראשון עד 12:00",
    items: [
      { item: "עגבניות סן מרזנו", amount: "3 מארזים" },
      { item: "עגבניות שלמות מקולפות", amount: "7 מארזים" },
      { item: "שמן זית", amount: "1 פח" },
      { item: "מחית פטריות כמהין", amount: "1 קרטון" },
      { item: "מלח פלור דה סלור", amount: "5 יח׳" },
    ],
  },
  {
    supplier: "ריסטרטו",
    category: "כללי",
    type: "static",
    callout: "אספקה: יום רביעי · דדליין הזמנה: יום שלישי עד 12:00",
    items: [
      { item: "ארטישוק", amount: "2 קרטונים" },
      { item: "חלפיניו", amount: "1 קרטון + 5 יח׳" },
      { item: "צ׳יפוטלה", amount: "3 יח׳" },
      { item: "אנשובי", amount: "4 יח׳" },
      { item: "קמח Ruvida", amount: "10 שקים" },
      { item: "פורמולה גלידת וניל", amount: "3 שקיות" },
      { item: "פורמולה אבקת מסקרפונה", amount: "1" },
      { item: "צלפים", amount: "קרטון + 4 יח׳" },
      { item: "בלסמי", amount: "12 יח׳" },
      { item: "פסטה ריגטוני", amount: "1.5 קרטון" },
    ],
  },
  {
    supplier: "ישראקו",
    category: "ייבוא וחומרי גלם",
    type: "static",
    callout: "אספקה: יום שני וחמישי",
    items: [
      { item: "בייקון", amount: "15 ק״ג" },
      { item: "פפרוני", amount: "20 ק״ג" },
      { item: "רביולי", amount: "3 קרטונים" },
      { item: "טורטליני", amount: "2 קרטונים" },
      { item: "קממבר", amount: "1 קרטון + 6 יח׳" },
      { item: "כתף בקר", amount: "4 יח׳" },
      { item: "גורגונזולה", amount: "3 יח׳" },
      { item: "כרובית", amount: "1.5 קרטונים" },
    ],
  },
  {
    supplier: "רדקס יבוא ושיווק",
    category: "כללי",
    type: "static",
    callout: "אספקה: יום שני",
    items: [
      { item: "ארדינגר", amount: "2 חביות" },
      { item: "קסטיל רוז׳", amount: "2 חביות" },
      { item: "באדווייזר", amount: "2 חביות" },
      { item: "בלון גז", amount: "2 בלונים" },
    ],
  },
  {
    supplier: "פסטטריה",
    category: "פסטות",
    type: "static",
    callout: "אספקה: יום רביעי",
    items: [{ item: "פפרדלה", amount: "100 ק״ג" }],
  },
  {
    supplier: "פרש פסטה פרימיום פקטורי",
    category: "פסטה טרייה",
    type: "static",
    callout: "אספקה: יום שלישי · דדליין: יום שני",
    items: [{ item: "ארנצ׳יני", amount: "1.5 קרטונים" }],
  },
  {
    supplier: "מאפיית בנדיקט",
    category: "בצקים",
    type: "split_days",
    callout: "אספקה: ראשון / שלישי / חמישי · דדליין: יום קודם",
    days: {
      "ראשון": [{ item: "בצק 440 גרם", amount: "20 קרטונים" }],
      "שלישי": [{ item: "בצק 440 גרם", amount: "20 קרטונים" }],
      "חמישי": [{ item: "בצק 440 גרם", amount: "לפי הצורך" }],
    },
  },
  {
    supplier: "מחלבת געש",
    category: "מחלבה",
    type: "split_days",
    callout: "עדכוני כמויות בהתאם לנפח עבודה מבצעים על הזמנת יום רביעי.",
    days: {
      "ראשון": [
        { item: "מוצרלה מגורדת", amount: 35 },
        { item: "שמנת לבישול", amount: 3 },
        { item: "מוצרלה פרסקה", amount: 2 },
        { item: "בושה עיזים", amount: 2 },
        { item: "גבינה בולגרית", amount: 1 },
        { item: "מסקרפונה", amount: 1 },
      ],
      "רביעי": [
        { item: "מוצרלה מגורדת", amount: 55 },
        { item: "שמנת לבישול", amount: 8 },
        { item: "מוצרלה פרסקה", amount: 5 },
        { item: "בושה עיזים", amount: 3 },
        { item: "גבינה בולגרית", amount: 2 },
        { item: "מסקרפונה", amount: 1 },
        { item: "מוצרלה נאפולי", amount: 5 },
      ],
    },
  },
  {
    supplier: "צח ייבוא ושיווק",
    category: "חומרי ניקוי וחד״פ",
    type: "static",
    callout: "אספקה: ראשון / רביעי · דדליין: שלישי / חמישי",
    items: [
      { item: "אקונומיקה", amount: 6 },
      { item: "נייר גדול", amount: 8 },
      { item: "נוזל שטיפת רצפות", amount: 6 },
      { item: "ניקוי חלונות", amount: 2 },
      { item: "נוזל כלים", amount: 6 },
      { item: "מסיר שומנים", amount: 6 },
      { item: "סבון מדיח", amount: 2 },
      { item: "קשים", amount: "1 קרטון" },
      { item: "כוסות חצי", amount: "1 קרטון + 5 שרוולים" },
      { item: "כוסות שליש", amount: "1 קרטון + 5 שרוולים" },
      { item: "כוסות חד״פ", amount: "1 קרטון + 5 שרוולים" },
      { item: "דיפ 30", amount: "2 קרטונים" },
      { item: "דיפ 50", amount: "2 קרטונים" },
      { item: "כפות", amount: "1 קרטון + 3 יח׳" },
      { item: "סקוצ׳ים", amount: 20 },
      { item: "מגבונים לחים", amount: "2 קרטונים" },
      { item: "צץ רץ", amount: "2 קרטונים" },
      { item: "מזלגות", amount: "2 קרטונים" },
      { item: "מילוי מגבונים", amount: "2 קרטונים" },
      { item: "מכסה לקערת פסטה", amount: "2 קרטונים" },
      { item: "קערת פסטה", amount: "2 קרטונים" },
      { item: "סלייסים קטנים", amount: "4 קרטונים" },
      { item: "שקיות אשפה", amount: "1 קרטון" },
      { item: "סמרטוטים", amount: 72 },
      { item: "סכינים", amount: "1 קרטון + 5 יח׳" },
    ],
  },
  {
    supplier: "י.שבי",
    category: "יבשים",
    type: "static",
    items: [
      { item: "נוטלה", amount: "6 קרטונים" },
      { item: "שוקולד לבן", amount: 3 },
      { item: "קרם קינדר", amount: 3 },
      { item: "קרם פיסטוק", amount: 6 },
      { item: "קרם תות", amount: 2 },
      { item: "קרם קרמל", amount: 3 },
      { item: "סוכר", amount: "4 מארזים" },
      { item: "מלח", amount: "3 מארזים" },
      { item: "שום גבישי", amount: 8 },
      { item: "אורגנו", amount: 2 },
      { item: "צ׳ילי / שטה גרוס", amount: 2 },
      { item: "דבש", amount: 6 },
      { item: "פלפל גרוס", amount: 1 },
      { item: "פפריקה מעושנת", amount: 1 },
      { item: "שמן סויה", amount: 3 },
      { item: "מיונז הלמנס", amount: 8 },
      { item: "חרדל דיז׳ון", amount: 1 },
      { item: "חרדל חלק", amount: 1 },
      { item: "מיץ לימון", amount: 1 },
      { item: "תירס", amount: "1 קרטון + 3 יח׳" },
      { item: "אננס חתוך", amount: "1 קרטון + 3 יח׳" },
      { item: "זיתים ירוקים", amount: 4 },
      { item: "עוגיות אוראו", amount: "1.5 קרטון" },
      { item: "פירורי לחם", amount: "1 שק + 2.5 ק״ג" },
      { item: "טרופיות", amount: "8 קרטונים" },
      { item: "תבלין פיצה", amount: "4 קרטונים" },
      { item: "טבסקו אדום", amount: "2 מארזים" },
      { item: "טבסקו ירוק", amount: "1 מארז" },
      { item: "סרירצ׳ה", amount: "1 קרטון" },
    ],
  },
  {
    supplier: "החברה המרכזית",
    category: "שתייה קלה",
    type: "static",
    callout: "אספקה: יום חמישי · דדליין: יום שבת",
    items: [],
  },
];
