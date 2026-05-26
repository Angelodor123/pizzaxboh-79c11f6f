import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { generateText, Output } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import type { Database } from "@/integrations/supabase/types";

const MatchSchema = z.object({
  team_a: z.string().min(1).max(80),
  team_b: z.string().min(1).max(80),
  competition: z.enum(["champions_league", "world_cup", "other"]),
  event_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  start_time: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
});

const MatchesSchema = z.object({ matches: z.array(MatchSchema).max(40) });

const SYS = `אתה עוזר שמספק רשימה של משחקי כדורגל גדולים קרובים — ליגת האלופות של אופ"א ומונדיאל פיפ"א 2026 (יוני-יולי 2026).
- החזר רק משחקים שעדיין לא נערכו, החל מהתאריך הנוכחי ועד 60 ימים קדימה.
- שמות הקבוצות בעברית אם מקובל, אחרת באנגלית.
- שעת התחלה בפורמט HH:MM (24h, שעון ישראל).
- אם אינך בטוח, אל תכלול. עדיף פחות אבל מדויק.`;

export const Route = createFileRoute("/api/public/hooks/sports-sync")({
  server: {
    handlers: {
      POST: async () => {
        try {
          const SUPABASE_URL = process.env.SUPABASE_URL!;
          const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
          const key = process.env.LOVABLE_API_KEY!;
          if (!SUPABASE_URL || !SERVICE || !key) {
            return new Response(JSON.stringify({ ok: false, error: "missing env" }), {
              status: 500,
              headers: { "Content-Type": "application/json" },
            });
          }

          const supabase = createClient<Database>(SUPABASE_URL, SERVICE, {
            auth: { persistSession: false, autoRefreshToken: false },
          });

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

          // Run for all active branches
          const { data: branches } = await supabase
            .from("branches")
            .select("id")
            .eq("active", true);

          let inserted = 0;
          let skipped = 0;

          for (const br of branches ?? []) {
            for (const m of matches) {
              const title = `שידור משחק: ${m.team_a} vs ${m.team_b}`;
              const competitionLabel =
                m.competition === "world_cup"
                  ? "מונדיאל"
                  : m.competition === "champions_league"
                    ? "ליגת אלופות"
                    : "כדורגל";
              const notes = `משחק ${competitionLabel} - לוודא מקרן וסאונד`;

              const { data: existing } = await supabase
                .from("calendar_events")
                .select("id")
                .eq("branch_id", br.id)
                .eq("event_date", m.event_date)
                .eq("title", title)
                .maybeSingle();

              if (existing) {
                skipped++;
                continue;
              }

              const { error } = await supabase.from("calendar_events").insert({
                branch_id: br.id,
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
          }

          return new Response(
            JSON.stringify({ ok: true, inserted, skipped, total: matches.length }),
            { headers: { "Content-Type": "application/json" } },
          );
        } catch (e) {
          console.error("sports-sync error", e);
          return new Response(
            JSON.stringify({ ok: false, error: String(e) }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
      },
    },
  },
});
