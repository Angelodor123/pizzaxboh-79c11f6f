import { createServerFn } from "@tanstack/react-start";
import { generateText, Output } from "ai";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

const InputSchema = z.object({
  // base64 data URL: data:image/jpeg;base64,....
  imageDataUrl: z.string().min(20).max(15_000_000),
  mimeType: z.string().min(3).max(60).optional(),
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

const SYSTEM = `אתה מערכת OCR לקבלות וחשבוניות בעברית.
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
    // Active-role gate
    const { data: role } = await context.supabase.rpc("current_user_role");
    if (!role) throw new Error("Unauthorized");

    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    const gateway = createLovableAiGatewayProvider(key);
    const model = gateway("google/gemini-2.5-flash");

    const { output } = await generateText({
      model,
      system: SYSTEM,
      output: Output.object({ schema: ParsedSchema }),
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "פענח את החשבונית/קבלה הזו. החזר JSON תקין בלבד.",
            },
            {
              type: "image",
              image: data.imageDataUrl,
              mediaType: data.mimeType ?? "image/jpeg",
            },
          ],
        },
      ],
    });

    return output;
  });
