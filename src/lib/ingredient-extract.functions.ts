import { createServerFn } from "@tanstack/react-start";
import { generateText, Output } from "ai";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

const InputSchema = z.object({
  title: z.string().min(1).max(500),
});

const OutputSchema = z.object({
  name: z.string().min(1).max(120),
  catalogProductId: z.string().nullable(),
  unit: z.string().nullable(),
  confidence: z.enum(["high", "low"]),
});

export type ExtractedIngredient = z.infer<typeof OutputSchema>;

/**
 * Extract the pure raw-material name from a task title (Hebrew).
 * Example: "להפריד עלי בזיליקום" → "בזיליקום".
 * If a supplier_products catalog item closely matches, returns its id+unit.
 */
export const extractIngredientFromTitle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data, context }): Promise<ExtractedIngredient> => {
    const { supabase } = context;

    // Load the master catalog (RLS scopes to the user's branch).
    const { data: products } = await supabase
      .from("supplier_products")
      .select("id, name, unit")
      .eq("active", true)
      .order("name", { ascending: true })
      .limit(500);

    const catalog = (products ?? []) as Array<{ id: string; name: string; unit: string }>;

    const key = process.env.LOVABLE_API_KEY;
    if (!key) {
      // Graceful fallback: return raw title with low confidence so UI asks user.
      return { name: data.title.trim(), catalogProductId: null, unit: null, confidence: "low" };
    }

    const catalogBlock =
      catalog.length > 0
        ? `\n\nרשימת חומרי-גלם בקטלוג (השתמש כדי להתאים שם קנוני):\n` +
          catalog.map((p) => `- ${p.name} [${p.id}] (${p.unit})`).join("\n")
        : "";

    const gateway = createLovableAiGatewayProvider(key);
    const model = gateway("google/gemini-2.5-flash-lite");

    try {
      const { output } = await generateText({
        model,
        system:
          `אתה עוזר במטבח. המשתמש נותן לך כותרת של משימה בעברית (לדוגמה: "להפריד עלי בזיליקום" או "לחתוך עגבניות שרי"). ` +
          `החזר אך ורק את שם חומר הגלם הגולמי (לדוגמה: "בזיליקום", "עגבניות שרי"), בלי פעלים, בלי תיאורי פעולה. ` +
          `אם יש פריט מתאים בקטלוג למטה — החזר את ה-id ואת ה-unit שלו והשתמש בשם הקנוני שלו. ` +
          `confidence="high" רק אם זיהית פריט ברור (עם או בלי התאמת קטלוג). confidence="low" אם הכותרת עמומה או יש כמה אפשרויות.` +
          catalogBlock,
        output: Output.object({ schema: OutputSchema }),
        messages: [
          { role: "user", content: `כותרת המשימה: "${data.title}"` },
        ],
      });

      const parsed = output as ExtractedIngredient;
      // Validate catalogProductId actually exists in our catalog (AI hallucination guard)
      if (parsed.catalogProductId && !catalog.find((p) => p.id === parsed.catalogProductId)) {
        parsed.catalogProductId = null;
        parsed.unit = null;
      }
      return parsed;
    } catch {
      return { name: data.title.trim(), catalogProductId: null, unit: null, confidence: "low" };
    }
  });
