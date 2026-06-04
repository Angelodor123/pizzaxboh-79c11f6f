import { supabase } from "@/integrations/supabase/client";

export type SupplierProduct = {
  id: string;
  supplier_id: string;
  branch_id: string;
  name: string;
  image_url: string | null;
  unit: string;
  default_qty: number;
  price: number | null;
  barcode: string | null;
  category: string | null;
  notes: string | null;
  sort_order: number;
  active: boolean;
  sku: string | null;
  unit_size: string | null;
  expected_price: number | null;
  cost_price: number | null;
  min_stock_alert: number | null;
};

export const CATALOG_UNITS = ["ק״ג", "גרם", "ליטר", "מ״ל", "יח׳", "ארגז"] as const;

export const CATALOG_CATEGORIES = [
  "ירקות ופירות",
  "בשרים",
  "מוצרי חלב",
  "יבשים",
  "משקאות",
  "אריזה וחד״פ",
  "ניקיון",
  "אחר",
] as const;

export async function loadSupplierProducts(supplierId: string): Promise<SupplierProduct[]> {
  const { data, error } = await supabase
    .from("supplier_products")
    .select("*")
    .eq("supplier_id", supplierId)
    .eq("active", true)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as SupplierProduct[];
}

/** Normalize a string for fuzzy matching (lowercase, trim, strip punctuation/extra spaces). */
export function normalizeName(s: string): string {
  return (s ?? "")
    .toLowerCase()
    .replace(/["'״׳`.,()\-/\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Returns true if the two normalized names share enough overlap to be considered a match. */
export function fuzzyMatch(a: string, b: string): boolean {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) return true;
  const ta = new Set(na.split(" ").filter((w) => w.length >= 2));
  const tb = new Set(nb.split(" ").filter((w) => w.length >= 2));
  if (!ta.size || !tb.size) return false;
  let overlap = 0;
  for (const w of ta) if (tb.has(w)) overlap++;
  return overlap >= Math.min(ta.size, tb.size);
}
