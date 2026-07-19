import { createServerFn } from "@tanstack/react-start";
import { generateText, Output } from "ai";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

const CatalogItemSchema = z.object({
  name: z.string().max(200),
  sku: z.string().max(80).nullable().optional(),
  unit: z.string().max(40).nullable().optional(),
  unit_size: z.string().max(40).nullable().optional(),
  price: z.number().nullable().optional(),
  barcode: z.string().max(80).nullable().optional(),
});

const InputSchema = z.object({
  // base64 data URL: data:image/jpeg;base64,....
  imageDataUrl: z.string().min(20).max(15_000_000),
  mimeType: z.string().min(3).max(60).optional(),
  supplierId: z.string().uuid().optional(),
  supplierCatalog: z.array(CatalogItemSchema).max(400).optional(),
});

const NumLike = z.preprocess((v) => {
  if (v == null || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") {
    // Strip currency symbols (₪, ש"ח / ש״ח / שח, NIS/ILS), commas, and any non-numeric noise
    const cleaned = v
      .replace(/[₪$€£]/g, "")
      .replace(/ש["״']?\s*ח/g, "")
      .replace(/NIS|ILS/gi, "")
      .replace(/,/g, "")
      .replace(/[^\d.\-]/g, "")
      .trim();
    if (!cleaned) return null;
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}, z.number().nullable());

// Normalize dates to ISO YYYY-MM-DD. Accepts ISO, DD/MM/YYYY, DD-MM-YYYY,
// DD.MM.YYYY (2- or 4-digit years). Returns null when unparseable so the
// rest of the receipt still loads.
const DateLike = z.preprocess((v) => {
  if (v == null || v === "") return null;
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (!s) return null;

  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    const y = +iso[1], m = +iso[2], d = +iso[3];
    const dt = new Date(Date.UTC(y, m - 1, d));
    if (dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d) {
      return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    }
    return null;
  }

  const dmy = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (dmy) {
    const [, dStr, mStr, yStr] = dmy;
    let y = parseInt(yStr, 10);
    if (y < 100) y += 2000;
    const d = parseInt(dStr, 10);
    const m = parseInt(mStr, 10);
    if (m < 1 || m > 12 || d < 1 || d > 31) return null;
    const dt = new Date(Date.UTC(y, m - 1, d));
    if (dt.getUTCDate() !== d || dt.getUTCMonth() !== m - 1) return null;
    return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }
  return null;
}, z.string().nullable());

const ParsedSchema = z.object({
  supplier_guess: z.string().max(120).nullable().optional(),
  invoice_number: z.string().max(60).nullable().optional(),
  document_date: DateLike.optional(),
  total_amount: NumLike.optional(),
  items: z
    .array(
      z.object({
        item_name: z.string().min(1).max(200),
        quantity: NumLike.optional(),
        base_unit_price: NumLike.optional(),
        unit_price: NumLike.optional(),
        total_price: NumLike.optional(),
        discount: z.coerce.string().max(40).nullable().optional(),
      }),
    )
    .max(80),
});

export type ParsedInvoice = z.infer<typeof ParsedSchema>;

const BASE_SYSTEM = `אתה מערכת OCR לקבלות וחשבוניות בעברית, מבוססת Google Gemini Vision.
- קרא את כל השורות, התעלם מלוגואים, כותרות עיצוביות, חתימות, חותמות וברקודים.
- חלץ עבור כל שורת פריט: שם פריט נקי (בעברית אם קיים), כמות, מחיר בסיס, הנחה, מחיר נטו ליחידה, וסה"כ.
- אם ערך לא ברור — החזר null (אל תנחש מספרים). שדה items חייב להיות מערך, גם אם ריק.

🚚 פריטי אריזה/פיקדון (כלול אותם!):
- כלול תמיד בפלט items פריטי אריזה/לוגיסטיקה כמו "משטח יורו פלסטיק", "משטח עץ", "משטח", "פלטה", "ארגז ריק", "מארז החזרה", "פיקדון", "בקבוקים ריקים", "Pallet", "Crate", "Deposit".
- שמור את שם הפריט במדויק כפי שמופיע במסמך (למשל "משטח יורו פלסטיק"), עם הכמות. אם אין מחיר במסמך — השאר את שדות המחירים כ-null.
- אל תמציא מחירים לפריטי פיקדון גם אם הם מופיעים ללא מחיר.

📄 טיפול בתעודות משלוח (ללא מחירים):
- אם המסמך הוא תעודת משלוח (תעודת משלוח / ת.מ. / Delivery Note) ואין בו מחירים — חלץ במדויק את שמות הפריטים והכמויות.
- השאר את base_unit_price, unit_price, total_price, total_amount כ-null. אל תמציא מחירים, אל תשתמש במחירים מהקטלוג, ואל תיכשל בגלל היעדר מחירים.
- discount=null במקרה כזה.

🔢 נרמול מספרים (חשוב מאוד!):
- כל שדה מספרי (total_amount, quantity, base_unit_price, unit_price, total_price) חייב להיות מספר float טהור או null.
- הסר לחלוטין סימני מטבע (₪, $, €), המחרוזות "ש״ח"/"ש"ח"/"שח"/"NIS"/"ILS", פסיקי אלפים, רווחים וכל טקסט נלווה.
- דוגמאות: "₪569.86" → 569.86, "569,86 ש״ח" → 569.86, "1,234.50 שח" → 1234.50.
- חפש total_amount תחת תוויות כמו: "סה״כ לתשלום", "סה"כ", "סך הכל", "לתשלום", "Total", "Grand Total". זה תמיד הסכום הסופי הכולל מע״מ.
- אם המסמך לא מציג סכום כולל בכלל (כמו בתעודת משלוח) — החזר total_amount=null. אל תחשב/תמציא.
- אל תחזיר אף פעם מחרוזת עם סימן מטבע או טקסט בשדה מספרי.

📅 נרמול תאריך (חשוב מאוד!):
- שדה document_date חייב להיות בפורמט ISO מחמיר YYYY-MM-DD בלבד (לדוגמה "2026-05-27").
- המר תאריכים כמו "27/05/26", "27.5.2026", "27-05-26" לפורמט "2026-05-27" (פורמט ישראלי: יום/חודש/שנה).
- אם השנה דו-ספרתית, הוסף לה 2000.
- חפש את התאריך בראש המסמך, ליד מספר החשבונית, או בתחתית. תוויות נפוצות: "תאריך", "תאריך הפקה", "תאריך חשבונית", "Date".
- אם התאריך מוסתר על ידי חותמת או אינו קריא — החזר null. אל תמציא תאריך.

🟠 טיפול בהנחות — מחיר בסיס מול נטו (קריטי!):
- סרוק בכל שורה אם קיימת עמודת "הנחה", "% הנחה", "Discount", "הנחה %", "הנח'" וכד׳.
- base_unit_price = מחיר היחידה המקורי כפי שמופיע על הקבלה לפני ההנחה (ברוטו). תמיד החזר את הערך הגולמי שמופיע במסמך.
- unit_price = מחיר היחידה הסופי לאחר ההנחה (נטו). חשב: אם ההנחה באחוזים → base × (1 − pct/100). אם ההנחה בסכום ליחידה → base − amt.
- שדה discount הוא טקסט קצר שמתאר את ההנחה כפי שהיא במסמך, לדוגמה: "10%", "15% הנחה", "₪5", "5 ש״ח".
- אם אין הנחה לשורה: החזר discount=null, ו-unit_price = base_unit_price (אותו מספר).
- אם אין מחיר בסיס במפורש ויש רק מחיר אחד — base_unit_price = unit_price (אותו מספר), discount=null.
- total_price חייב להיות תמיד quantity × unit_price (נטו).

🧮 הנחות סמויות / מובלעות (חובה — לא רק לפי טקסט מודפס!):
- אל תסתמך רק על טקסט "הנחה" במסמך. ספקים מסוימים (כגון מרינה) מחילים הנחה פר-פריט בלי לציין אותה ויזואלית בכלל (אין עמודת הנחה, אין אחוז מודפס, או העמודה ריקה).
- עבור כל שורת פריט עם quantity, base_unit_price ו-total_price מודפסים — בצע בדיקה מתמטית מחייבת:
   Expected = quantity × base_unit_price.
   אם total_price המודפס בפועל קטן מ-Expected ביותר מ-1% → קיימת הנחה מובלעת.
- חשב את אחוז ההנחה: pct = round((1 − printed_total / Expected) × 100, 2). מלא discount="<pct>%" (לדוגמה "10%").
- עדכן unit_price = printed_total / quantity (הנטו האמיתי), ו-total_price = printed_total. base_unit_price נשאר הערך הגולמי המקורי.
- כך גם אם המסמך לא הציג שום סימן ויזואלי להנחה — המתמטיקה בפלט תהיה שקופה ועקבית: total_price = quantity × unit_price, ו-base_unit_price × (1 − discount%) = unit_price.
- אם המתמטיקה לא מסתדרת (Expected ≈ printed_total) — אין הנחה, discount=null ו-unit_price=base_unit_price.`;


function buildCatalogBlock(catalog: z.infer<typeof CatalogItemSchema>[] | undefined, supplierName: string | null): string {
  if (!catalog || catalog.length === 0) return "";
  const lines = catalog.slice(0, 200).map((c, i) => {
    const parts: string[] = [`${i + 1}. ${c.name}`];
    if (c.sku) parts.push(`SKU:${c.sku}`);
    if (c.unit_size) parts.push(`גודל:${c.unit_size}`);
    if (c.unit) parts.push(`יח׳:${c.unit}`);
    if (c.price != null) parts.push(`מחיר צפוי:${c.price}`);
    if (c.barcode) parts.push(`ברקוד:${c.barcode}`);
    return parts.join(" | ");
  });
  const nameLabel = supplierName ? ` של הספק "${supplierName}"` : "";
  return `\n\n📚 קטלוג ידוע${nameLabel} (RAG context):
השתמש ברשימה הזו כדי למפות במדויק את שמות הפריטים שזיהית לשמות הקנוניים שלנו (החזר את השם המדויק מהקטלוג כאשר יש התאמה), לאמת מחירים צפויים, ולזהות אנומליות בהנחות ספציפיות של הספק.
${lines.join("\n")}`;
}

export const parseInvoiceImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { data: role } = await context.supabase.rpc("current_user_role");
    if (!role) throw new Error("Unauthorized");

    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    // Load supplier-specific parsing instructions (autonomous learning)
    let supplierHint = "";
    let supplierName: string | null = null;
    if (data.supplierId) {
      const { data: sup } = await context.supabase
        .from("suppliers")
        .select("name, parsing_instructions")
        .eq("id", data.supplierId)
        .maybeSingle();
      if (sup?.name) supplierName = sup.name;
      if (sup?.parsing_instructions) {
        supplierHint = `\n\nהנחיות ספציפיות לספק "${sup.name}" (נלמדו אוטומטית מתיקונים קודמים):\n${sup.parsing_instructions}`;
      }
    }

    const catalogBlock = buildCatalogBlock(data.supplierCatalog, supplierName);

    const gateway = createLovableAiGatewayProvider(key);
    const model = gateway("google/gemini-2.5-flash");

    const { output } = await generateText({
      model,
      system: BASE_SYSTEM + supplierHint + catalogBlock,
      output: Output.object({ schema: ParsedSchema }),
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "פענח את החשבונית/קבלה הזו. החזר JSON תקין בלבד." },
            {
              type: "image",
              image: data.imageDataUrl,
              mediaType: data.mimeType ?? "image/jpeg",
            },
          ],
        },
      ],
    });

    // Cache raw OCR onto supplier for the learning loop
    if (data.supplierId) {
      await context.supabase
        .from("suppliers")
        .update({ last_raw_ocr: output as unknown as never })
        .eq("id", data.supplierId);
    }

    return output;
  });

// ============================================================
// Autonomous background learning: compare raw vs corrected,
// extract differences, update supplier parsing_instructions.
// ============================================================

const LearnInput = z.object({
  supplierId: z.string().uuid(),
  invoiceId: z.string().uuid().optional(),
  raw: z.unknown(),
  final: z.unknown(),
});

export const learnFromCorrection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => LearnInput.parse(data))
  .handler(async ({ data, context }) => {
    const { data: role } = await context.supabase.rpc("current_user_role");
    if (role !== "admin") return { skipped: true, reason: "role" };

    const { data: sup } = await context.supabase
      .from("suppliers")
      .select("name, parsing_instructions, branch_id")
      .eq("id", data.supplierId)
      .maybeSingle();
    if (!sup) return { skipped: true, reason: "supplier" };

    // Derive a deterministic diff_summary from the validation breakdown the UI sent.
    // This guarantees XP/streak update even when the AI gateway is unavailable.
    const finalObj = (data.final ?? {}) as Record<string, unknown>;
    const validation = (finalObj._validation ?? {}) as {
      summary?: { approved?: number; corrected?: number };
    };
    const approved = Number(validation.summary?.approved) || 0;
    const corrected = Number(validation.summary?.corrected) || 0;
    const diffSummary = corrected === 0 && approved > 0 ? "perfect" : `edits:${corrected}`;

    // 1) ALWAYS insert the feedback row first — this is the source of truth for XP/history.
    const { data: inserted, error: insertErr } = await context.supabase
      .from("invoice_ocr_feedback")
      .insert({
        supplier_id: data.supplierId,
        invoice_id: data.invoiceId ?? null,
        branch_id: sup.branch_id,
        raw_ocr: data.raw as unknown as never,
        final_data: data.final as unknown as never,
        diff_summary: diffSummary,
      })
      .select("id")
      .maybeSingle();
    if (insertErr) return { skipped: true, reason: "insert", error: insertErr.message };

    // 2) Optionally enrich supplier parsing_instructions via AI. Failure here
    // does NOT cancel the training event — the feedback row is already saved.
    const key = process.env.LOVABLE_API_KEY;
    if (!key) return { learned: false, feedbackId: inserted?.id, diff: diffSummary };

    const rawStr = JSON.stringify(data.raw ?? {}, null, 2).slice(0, 8000);
    const finalStr = JSON.stringify(data.final ?? {}, null, 2).slice(0, 8000);
    if (rawStr === finalStr) {
      return { learned: false, feedbackId: inserted?.id, diff: diffSummary, reason: "no-diff" };
    }

    const existing = (sup.parsing_instructions ?? "").slice(0, 4000);
    const gateway = createLovableAiGatewayProvider(key);
    const model = gateway("google/gemini-2.5-flash-lite");
    const Schema = z.object({
      updated_instructions: z.string().max(2000),
      diff_summary: z.string().max(500),
    });

    try {
      const { output } = await generateText({
        model,
        system:
          'אתה מנתח דפוסי שגיאה ב-OCR של חשבוניות בעברית. מטרתך לבנות הנחיות ספציפיות לספק שיגרמו ל-OCR לבצע פחות טעויות. ' +
          'נתח את ההבדלים בין הפלט הגולמי של ה-OCR לבין הנתונים המתוקנים על ידי המשתמש. ' +
          'הפק הנחיות קצרות וברורות בעברית (עד 10 שורות). אם קיימות כבר הנחיות — מזג עם החדשות, השאר רלוונטיות והסר סותרות. החזר JSON עם updated_instructions ו-diff_summary.',
        output: Output.object({ schema: Schema }),
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text:
                  `ספק: ${sup.name}\n\nהנחיות קיימות:\n${existing || "(אין)"}\n\n` +
                  `פלט OCR גולמי:\n${rawStr}\n\nנתונים מתוקנים על ידי המשתמש:\n${finalStr}`,
              },
            ],
          },
        ],
      });

      await context.supabase
        .from("suppliers")
        .update({ parsing_instructions: output.updated_instructions })
        .eq("id", data.supplierId);

      // Enrich the feedback row with the human-readable AI diff summary.
      if (inserted?.id) {
        await context.supabase
          .from("invoice_ocr_feedback")
          .update({ diff_summary: `${diffSummary} · ${output.diff_summary}` })
          .eq("id", inserted.id);
      }

      return { learned: true, feedbackId: inserted?.id, diff: diffSummary, summary: output.diff_summary };
    } catch (e) {
      return { learned: false, feedbackId: inserted?.id, diff: diffSummary, reason: "ai-error", error: (e as Error).message };
    }
  });

