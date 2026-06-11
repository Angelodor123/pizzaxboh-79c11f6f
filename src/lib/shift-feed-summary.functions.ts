import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

const InputSchema = z.object({
  branchId: z.string().uuid(),
});

/** AI-generated daily summary of shift_feed activity for the current branch. */
export const summarizeShiftFeedToday = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data, context }): Promise<{ summary: string }> => {
    const { supabase } = context;
    const since = new Date();
    since.setHours(0, 0, 0, 0);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: posts } = await (supabase.from("shift_feed") as any)
      .select("message, category, created_at, user_id")
      .eq("branch_id", data.branchId)
      .gte("created_at", since.toISOString())
      .order("created_at", { ascending: true })
      .limit(80);

    const list = (posts ?? []) as Array<{ message: string; category: string; created_at: string }>;
    if (!list.length) return { summary: "אין עדכונים מהיום עדיין. הכל שקט ✌️" };

    const key = process.env.LOVABLE_API_KEY;
    if (!key) {
      return { summary: `נקלטו ${list.length} עדכונים היום (סיכום AI לא זמין).` };
    }

    const gateway = createLovableAiGatewayProvider(key);
    const model = gateway("google/gemini-2.5-flash-lite");

    const body = list
      .map((p) => `[${p.category}] ${new Date(p.created_at).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })} — ${p.message}`)
      .join("\n");

    try {
      const { text } = await generateText({
        model,
        system:
          "אתה עוזר תפעולי של פיצרייה. סכם בעברית, ב-3-5 בולטים קצרים, את עיקרי עדכוני המשמרת של היום. הדגש דחיפויות, תקלות, ואירועים בולטים. בלי הקדמה, בלי סיום, רק בולטים עם • בתחילת כל שורה.",
        messages: [{ role: "user", content: body }],
      });
      return { summary: text.trim() || `נקלטו ${list.length} עדכונים היום.` };
    } catch (e) {
      console.error("[shift-feed-summary]", e);
      return { summary: `נקלטו ${list.length} עדכונים היום (סיכום AI נכשל).` };
    }
  });
