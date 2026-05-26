import { createServerFn } from "@tanstack/react-start";
import { generateText, Output } from "ai";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

const MatchSchema = z.object({
  team_a: z.string().min(1).max(80),
  team_b: z.string().min(1).max(80),
  competition: z.enum(["champions_league", "world_cup", "other"]),
  event_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  start_time: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
});

const MatchesSchema = z.object({
  matches: z.array(MatchSchema).max(40),
});

const SYS = `אתה עוזר שמספק רשימה של משחקי כדורגל גדולים קרובים — ליגת האלופות של אופ"א ומונדיאל פיפ"א 2026 (יוני-יולי 2026).
- החזר רק משחקים שעדיין לא נערכו, החל מהתאריך הנוכחי ועד 60 ימים קדימה.
- ספק את שמות הקבוצות בעברית אם מקובל (לדוגמה "ריאל מדריד", "ארגנטינה"), אחרת באנגלית.
- שעת התחלה בפורמט HH:MM (24h, שעון ישראל).
- אם אינך בטוח במשחק, אל תכלול אותו. עדיף פחות אבל מדויק.
- competition: champions_league או world_cup או other.`;

export const syncSportsEvents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: role } = await context.supabase.rpc("current_user_role");
    if (role !== "admin") throw new Error("Unauthorized");

    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    // Determine branch
    const { data: branchRow } = await context.supabase.rpc("current_user_branch_id");
    let branchId = branchRow as string | null;
    if (!branchId) {
      const { data: b } = await context.supabase
        .from("branches")
        .select("id")
        .eq("active", true)
        .order("created_at")
        .limit(1)
        .maybeSingle();
      branchId = b?.id ?? null;
    }
    if (!branchId) throw new Error("No active branch found");

    const today = new Date().toISOString().slice(0, 10);
    const gateway = createLovableAiGatewayProvider(key);
    const model = gateway("google/gemini-2.5-flash");

    const { output } = await generateText({
      model,
      system: SYS,
      output: Output.object({ schema: MatchesSchema }),
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `התאריך היום: ${today}. החזר רשימת JSON של משחקי ליגת האלופות והמונדיאל 2026 הקרובים.`,
            },
          ],
        },
      ],
    });

    const matches = output.matches ?? [];
    let inserted = 0;
    let skipped = 0;

    for (const m of matches) {
      const title = `שידור משחק: ${m.team_a} vs ${m.team_b}`;
      const competitionLabel =
        m.competition === "world_cup"
          ? "מונדיאל"
          : m.competition === "champions_league"
            ? "ליגת אלופות"
            : "כדורגל";
      const notes = `משחק ${competitionLabel} - לוודא מקרן וסאונד`;

      // Dedupe: same title + date
      const { data: existing } = await context.supabase
        .from("calendar_events")
        .select("id")
        .eq("branch_id", branchId)
        .eq("event_date", m.event_date)
        .eq("title", title)
        .maybeSingle();

      if (existing) {
        skipped++;
        continue;
      }

      const { error } = await context.supabase.from("calendar_events").insert({
        branch_id: branchId,
        title,
        category: "marketing",
        event_type: "sports_match",
        event_date: m.event_date,
        start_time: m.start_time ?? null,
        end_time: null,
        notes,
        high_priority: false,
        is_auto: true,
      });
      if (!error) inserted++;
    }

    return {
      ok: true,
      inserted,
      skipped,
      total: matches.length,
    };
  });
