import benedict from "@/assets/suppliers/benedict.png";
import israco from "@/assets/suppliers/israco.png";
import ristretto from "@/assets/suppliers/ristretto.png";
import freshPasta from "@/assets/suppliers/fresh-pasta.jpeg";
import gaash from "@/assets/suppliers/gaash.jpeg";
import pastateria from "@/assets/suppliers/pastateria.jpeg";
import tzach from "@/assets/suppliers/tzach.png";
import marina from "@/assets/suppliers/marina.png";
import hevraMerkazit from "@/assets/suppliers/hevra-merkazit.png";

// Map supplier name (or key) → bundled logo asset.
// Falls back to supplier.logo_url if no local match.
const MAP: Record<string, string> = {
  "בנדיקט": benedict,
  "ישראקו": israco,
  "Ristretto": ristretto,
  "ריסטרטו": ristretto,
  "פרש פסטה": freshPasta,
  "פרש פסטה פרימיום פקטורי": freshPasta,
  "מחלבת געש": gaash,
  "געש": gaash,
  "פסטטריה": pastateria,
  "צח": tzach,
  "צח ייבוא ושיווק": tzach,
  "מרינה": marina,
  "מרינה - מלכת הפטריות": marina,
  "החברה המרכזית": hevraMerkazit,
};

export function resolveSupplierLogo(name: string, logoUrl?: string | null): string | null {
  if (logoUrl) return logoUrl;
  const direct = MAP[name];
  if (direct) return direct;
  // partial match
  const k = Object.keys(MAP).find((n) => name.includes(n) || n.includes(name));
  return k ? MAP[k] : null;
}

export const DEFAULT_SUPPLIERS: Array<{
  name: string;
  category: string;
  delivery_weekdays: number[];
  contact: string;
}> = [
  { name: "מרינה", category: "ירקות", delivery_weekdays: [0, 2, 4], contact: "" },
  { name: "מחלבת געש", category: "גבינות", delivery_weekdays: [0, 3], contact: "" },
  { name: "בנדיקט", category: "בצקים", delivery_weekdays: [1, 4], contact: "" },
  { name: "צח ייבוא ושיווק", category: "חומרי ניקוי וחד״פ", delivery_weekdays: [2], contact: "" },
  { name: "פסטטריה", category: "פסטות", delivery_weekdays: [1, 4], contact: "" },
  { name: "ישראקו", category: "ייבוא וחומרי גלם", delivery_weekdays: [2], contact: "" },
  { name: "החברה המרכזית", category: "שתייה קלה", delivery_weekdays: [0, 3], contact: "" },
  { name: "פרש פסטה פרימיום פקטורי", category: "פסטה טרייה", delivery_weekdays: [1, 4], contact: "" },
  { name: "Ristretto", category: "קפה ופרימיום", delivery_weekdays: [1], contact: "" },
  { name: "אנשי הזית", category: "שמן זית וחומרי גלם", delivery_weekdays: [3], contact: "" },
];
