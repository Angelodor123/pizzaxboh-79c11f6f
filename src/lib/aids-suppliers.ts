// Static catalog of supplier ordering standards (תקנים) for the "עזרים" view.
// Two table shapes:
//  - "static":  columns = שם מוצר, תקן
//  - "split":   columns = שם מוצר + per-day amounts (e.g. ראשון / רביעי)

export type StaticRow = { name: string; standard: string };
export type SplitRow = { name: string; amounts: Record<string, string> };

export type SupplierAid =
  | {
      id: string;
      name: string;
      category: string;
      kind: "static";
      callout?: string;
      rows: StaticRow[];
    }
  | {
      id: string;
      name: string;
      category: string;
      kind: "split";
      days: string[]; // e.g. ["ראשון", "רביעי"]
      callout?: string;
      rows: SplitRow[];
    };

export const SUPPLIER_AIDS: SupplierAid[] = [
  {
    id: "gaash",
    name: "מחלבת געש",
    category: "מחלבה",
    kind: "split",
    days: ["ראשון", "רביעי"],
    callout:
      "עדכוני כמויות בהתאם לנפח עבודה מבצעים על הזמנת יום רביעי.",
    rows: [
      { name: "מוצרלה מגורדת", amounts: { "ראשון": "—", "רביעי": "—" } },
      { name: "שמנת לבישול", amounts: { "ראשון": "—", "רביעי": "—" } },
      { name: "מוצרלה פרסקה", amounts: { "ראשון": "—", "רביעי": "—" } },
      { name: "בושה עיזים", amounts: { "ראשון": "—", "רביעי": "—" } },
      { name: "גבינה בולגרית", amounts: { "ראשון": "—", "רביעי": "—" } },
      { name: "מסקרפונה", amounts: { "ראשון": "—", "רביעי": "—" } },
      { name: "מוצרלה נאפולי", amounts: { "ראשון": "—", "רביעי": "—" } },
    ],
  },
  {
    id: "benedict",
    name: "מאפיית בנדיקט",
    category: "מאפייה",
    kind: "split",
    days: ["ראשון", "רביעי"],
    callout: "כמויות הבצק מתעדכנות לפי חיזוי הביקוש השבועי.",
    rows: [{ name: "בצק 440 גרם", amounts: { "ראשון": "—", "רביעי": "—" } }],
  },
  {
    id: "yshavi",
    name: "י.שבי (יבשים)",
    category: "יבשים",
    kind: "static",
    rows: [
      { name: "נוטלה", standard: "—" },
      { name: "שוקולד לבן", standard: "—" },
      { name: "קרם קינדר", standard: "—" },
      { name: "קרם פיסטוק", standard: "—" },
      { name: "קרם תות", standard: "—" },
      { name: "קרם קרמל", standard: "—" },
      { name: "סוכר", standard: "—" },
      { name: "מלח", standard: "—" },
      { name: "שום גבישי", standard: "—" },
      { name: "אורגנו", standard: "—" },
      { name: "צ׳ילי / שטה גרוס", standard: "—" },
      { name: "דבש", standard: "—" },
      { name: "פלפל גרוס", standard: "—" },
      { name: "פפריקה מעושנת", standard: "—" },
      { name: "שמן סויה", standard: "—" },
      { name: "מיונז הלמנס", standard: "—" },
      { name: "חרדל דיז׳ון", standard: "—" },
      { name: "חרדל חלק", standard: "—" },
      { name: "מיץ לימון", standard: "—" },
      { name: "תירס", standard: "—" },
    ],
  },
  {
    id: "tzach",
    name: "צח ייבוא ושיווק",
    category: "ייבוא",
    kind: "static",
    rows: [{ name: "אבקת מסקרפונה", standard: "—" }],
  },
  {
    id: "israko",
    name: "ישראקו",
    category: "יבשים",
    kind: "static",
    rows: [
      { name: "—", standard: "—" },
    ],
  },
  {
    id: "anshey-hazait",
    name: "אנשי הזית",
    category: "שמן וזיתים",
    kind: "static",
    rows: [
      { name: "עגבניות סן מרזנו", standard: "—" },
      { name: "עגבניות שלמות מקולפות", standard: "—" },
      { name: "שמן זית", standard: "—" },
      { name: "מחית פטריות כמהין", standard: "—" },
      { name: "מלח פלור דה סלור", standard: "—" },
    ],
  },
  {
    id: "radex",
    name: "רדקס",
    category: "משקאות",
    kind: "static",
    callout: "הזמנת חביות בתיאום מראש בלבד.",
    rows: [
      { name: "ארדינגר (חביות)", standard: "—" },
      { name: "קסטיל רוז׳ (חביות)", standard: "—" },
      { name: "באדווייזר (חביות)", standard: "—" },
      { name: "בלון גז", standard: "—" },
    ],
  },
  {
    id: "merkazit",
    name: "החברה המרכזית",
    category: "משקאות",
    kind: "static",
    rows: [
      { name: "זכוכית קולה", standard: "—" },
      { name: "זכוכית זירו", standard: "—" },
      { name: "זכוכית פאנטה", standard: "—" },
    ],
  },
  {
    id: "pastateria",
    name: "פסטטריה",
    category: "פסטה",
    kind: "static",
    rows: [{ name: "פפרדלה", standard: "—" }],
  },
  {
    id: "fresh-pasta",
    name: "פרש פסטה",
    category: "פסטה",
    kind: "static",
    rows: [{ name: "ארנצ׳יני", standard: "—" }],
  },
  {
    id: "sheleg",
    name: "שלג",
    category: "אריזה",
    kind: "static",
    rows: [{ name: "קרטונים", standard: "—" }],
  },
];
