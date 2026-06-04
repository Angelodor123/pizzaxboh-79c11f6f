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
    supplier: "מחלבת געש",
    category: "מחלבה",
    type: "split_days",
    callout:
      "עדכוני כמויות בהתאם לנפח עבודה מבצעים על הזמנת יום רביעי.",
    days: {
      "ראשון": [
        { item: "מוצרלה מגורדת", amount: 35 },
        { item: "שמנת לבישול", amount: 3 },
        { item: "מוצרלה פרסקה", amount: 2 },
        { item: "בושה עיזים", amount: 2 },
      ],
      "רביעי": [
        { item: "מוצרלה מגורדת", amount: 55 },
        { item: "שמנת לבישול", amount: 8 },
        { item: "מוצרלה פרסקה", amount: 5 },
        { item: "מוצרלה נאפולי", amount: 5 },
      ],
    },
  },
  {
    supplier: "י.שבי",
    category: "יבשים",
    type: "static",
    items: [
      { item: "נוטלה", amount: "6 קרטונים" },
      { item: "שוקולד לבן", amount: "3 יחידות" },
      { item: "קרם פיסטוק", amount: "6 יחידות" },
      { item: "סוכר", amount: "4 מארזים" },
    ],
  },
  {
    supplier: "צח סחר",
    category: "ייבוא",
    type: "static",
    items: [
      { item: "פח שמן זית", amount: 3 },
      { item: "קמח פיצה", amount: 20 },
      { item: "עגבניות פולפה", amount: 10 },
    ],
  },
];
