import { z } from "zod";
import { toast } from "sonner";

/**
 * Central zod schemas used as a server-bound validation layer before writes.
 * Forms can keep their existing useState wiring; we just call
 * `validateOrToast(schema, payload)` instead of ad-hoc `if (!name) toast.error(...)`
 * checks. This stops bad/oversized/malformed data from ever reaching Supabase,
 * which is the data-integrity goal.
 */

const trimmed = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, { message: `${label} ארוך מדי (עד ${max} תווים)` });

const optionalString = (max: number, label: string) =>
  trimmed(max, label)
    .optional()
    .nullable()
    .transform((v) => (v && v.length > 0 ? v : null));

const optionalNumber = (label: string, opts: { min?: number; max?: number } = {}) =>
  z
    .number({ error: `${label} חייב להיות מספר` })
    .finite()
    .refine((v) => opts.min === undefined || v >= opts.min, {
      message: `${label} חייב להיות לפחות ${opts.min}`,
    })
    .refine((v) => opts.max === undefined || v <= opts.max, {
      message: `${label} חורג מהמקסימום (${opts.max})`,
    })
    .nullable()
    .optional();

/* ------------------------ Supplier Catalog Product ----------------------- */

export const supplierProductSchema = z.object({
  name: trimmed(120, "שם המוצר").min(1, { message: "חובה להזין שם מוצר" }),
  sku: optionalString(64, "מק״ט"),
  unit_size: optionalString(50, "גודל יחידה"),
  unit: trimmed(20, "יחידת מידה").default(""),
  default_qty: z
    .number({ error: "כמות ברירת מחדל חייבת להיות מספר" })
    .min(0, { message: "כמות לא יכולה להיות שלילית" })
    .max(100000, { message: "כמות גבוהה מדי" }),
  price: optionalNumber("מחיר", { min: 0, max: 1000000 }),
  expected_price: optionalNumber("מחיר צפוי", { min: 0, max: 1000000 }),
  cost_price: optionalNumber("עלות", { min: 0, max: 1000000 }),
  category: optionalString(60, "קטגוריה"),
  min_stock_alert: optionalNumber("התראת מלאי", { min: 0, max: 100000 }),
  image_url: z.string().url().nullable().optional(),
});

export type SupplierProductInput = z.infer<typeof supplierProductSchema>;

/* ---------------------------- Supplier (entity) -------------------------- */

const HEBREW_PHONE = /^[+0-9\-\s()]{6,20}$/;

export const supplierFormSchema = z.object({
  name: trimmed(120, "שם הספק").min(1, { message: "חובה להזין שם ספק" }),
  category: trimmed(60, "קטגוריה").default("כללי"),
  contact: z
    .string()
    .trim()
    .max(200, { message: "פרטי קשר ארוכים מדי" })
    .refine((v) => v === "" || HEBREW_PHONE.test(v) || /\S+@\S+\.\S+/.test(v) || v.length >= 2, {
      message: "פרטי הקשר אינם תקינים",
    })
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
  notes: optionalString(2000, "הערות"),
  delivery_weekdays: z.array(z.number().int().min(0).max(6)).max(7),
  order_days: z.array(z.number().int().min(0).max(6)).max(7),
  delivery_days: z.array(z.number().int().min(0).max(6)).max(7),
  default_start_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).nullable().optional(),
  default_end_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).nullable().optional(),
  order_cutoff_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).nullable().optional(),
  active: z.boolean(),
  logo_url: z.string().url().nullable().optional(),
});

export type SupplierFormInput = z.infer<typeof supplierFormSchema>;

/* --------------------- Receiving Invoice (delivery) ---------------------- */

export const receivingHeaderSchema = z.object({
  supplier_id: z.string().uuid({ message: "ספק לא תקין" }),
  invoice_number: trimmed(50, "מספר חשבונית").optional().transform((v) => v ?? ""),
  document_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "תאריך לא תקין" }),
  total_amount: z
    .number({ error: "סכום חייב להיות מספר" })
    .positive({ message: "הסכום חייב להיות גדול מאפס" })
    .max(10000000, { message: "סכום גבוה מדי" }),
});

export type ReceivingHeaderInput = z.infer<typeof receivingHeaderSchema>;

/* ------------------------------- Helpers --------------------------------- */

/**
 * Validate a payload against a zod schema. On failure, surface the first
 * Hebrew error to the user via toast and return null. On success, return the
 * parsed (and normalized) value.
 *
 * Usage:
 *   const valid = validateOrToast(supplierProductSchema, payload);
 *   if (!valid) return;
 */
export function validateOrToast<T extends z.ZodTypeAny>(
  schema: T,
  payload: unknown,
): z.infer<T> | null {
  const result = schema.safeParse(payload);
  if (!result.success) {
    const first = result.error.issues[0];
    toast.error(first?.message ?? "אחד מהשדות אינו תקין");
    return null;
  }
  return result.data;
}
