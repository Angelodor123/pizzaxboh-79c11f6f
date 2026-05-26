import { createServerFn } from "@tanstack/react-start";
import { generateText, Output } from "ai";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

const InputSchema = z.object({
  // base64 data URL: data:image/jpeg;base64,....
  imageDataUrl: z.string().min(20).max(15_000_000),
  mimeType: z.string().min(3).max(60).optional(),
  supplierId: z.string().uuid().optional(),
});

const ParsedSchema = z.object({
  supplier_guess: z.string().max(120).nullable().optional(),
  invoice_number: z.string().max(60).nullable().optional(),
  document_date: z.string().max(20).nullable().optional(),
  total_amount: z.number().nullable().optional(),
  items: z
    .array(
      z.object({
        item_name: z.string().min(1).max(200),
        quantity: z.number().nullable().optional(),
        unit_price: z.number().nullable().optional(),
        total_price: z.number().nullable().optional(),
      }),
    )
    .max(80),
});

export type ParsedInvoice = z.infer<typeof ParsedSchema>;

const BASE_SYSTEM = `אתה מערכת OCR לקבלות וחשבוניות בעברית, מבוססת Google Gemini Vision.
- קרא את כל השורות, התעלם מלוגואים, כותרות עיצוביות, חתימות וברקודים.
- חלץ עבור כל שורת פריט: שם פריט נקי (בעברית אם קיים), כמות, מחיר ליחידה, וסה"כ.
- אם ערך לא ברור — החזר null (אל תנחש מספרים).
- מחירים בש"ח. החזר מספרים בלי סימנים (לא ₪, לא פסיקים).
- החזר גם את שם הספק, מספר החשבונית, תאריך (YYYY-MM-DD אם אפשר) וסך הכל.
- שדה items חייב להיות מערך, גם אם ריק.`;

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
    if (data.supplierId) {
      const { data: sup } = await context.supabase
        .from("suppliers")
        .select("name, parsing_instructions")
        .eq("id", data.supplierId)
        .maybeSingle();
      if (sup?.parsing_instructions) {
        supplierHint = `\n\nהנחיות ספציפיות לספק "${sup.name}" (נלמדו אוטומטית מתיקונים קודמים):\n${sup.parsing_instructions}`;
      }
    }

    const gateway = createLovableAiGatewayProvider(key);
    const model = gateway("google/gemini-2.5-flash");

    const { output } = await generateText({
      model,
      system: BASE_SYSTEM + supplierHint,
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
    if (role !== "admin") return { skipped: true };

    const key = process.env.LOVABLE_API_KEY;
    if (!key) return { skipped: true };

    const rawStr = JSON.stringify(data.raw ?? {}, null, 2).slice(0, 8000);
    const finalStr = JSON.stringify(data.final ?? {}, null, 2).slice(0, 8000);

    // Quick equality check — skip if no meaningful change
    if (rawStr === finalStr) return { skipped: true };

    const { data: sup } = await context.supabase
      .from("suppliers")
      .select("name, parsing_instructions, branch_id")
      .eq("id", data.supplierId)
      .maybeSingle();
    if (!sup) return { skipped: true };

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
          'הפק הנחיות קצרות וברורות בעברית (עד 10 שורות), לדוגמה: "מחיר ליחידה נמצא בעמודה השלישית מימין, לא השנייה". ' +
          'אם קיימות כבר הנחיות — מזג עם החדשות, השאר רלוונטיות והסר סותרות. החזר JSON עם updated_instructions ו-diff_summary.',
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

      await context.supabase.from("invoice_ocr_feedback").insert({
        supplier_id: data.supplierId,
        invoice_id: data.invoiceId ?? null,
        branch_id: sup.branch_id,
        raw_ocr: data.raw as unknown as never,
        final_data: data.final as unknown as never,
        diff_summary: output.diff_summary,
      });

      return { learned: true, summary: output.diff_summary };
    } catch {
      return { skipped: true };
    }
  });
