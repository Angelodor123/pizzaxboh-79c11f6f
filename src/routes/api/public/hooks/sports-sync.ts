import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type VerifiedMatch = {
  team_a: string;
  team_b: string;
  competition: "champions_league" | "world_cup" | "other";
  event_date: string;
  start_time: string;
  source_note: string;
};

const VERIFIED_MATCHES: VerifiedMatch[] = [
  {
    team_a: "PSG",
    team_b: "Arsenal",
    competition: "champions_league",
    event_date: "2026-05-30",
    start_time: "19:00",
    source_note: "אומת מול צילום מסך Google שסופק ומול עמוד המשחקים הרשמי של UEFA",
  },
];

export const Route = createFileRoute("/api/public/hooks/sports-sync")({
  server: {
    handlers: {
      POST: async () => {
        try {
          const SUPABASE_URL = process.env.SUPABASE_URL!;
          const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
          if (!SUPABASE_URL || !SERVICE) {
            return new Response(JSON.stringify({ ok: false, error: "missing env" }), {
              status: 500,
              headers: { "Content-Type": "application/json" },
            });
          }

          const supabase = createClient<Database>(SUPABASE_URL, SERVICE, {
            auth: { persistSession: false, autoRefreshToken: false },
          });

          const matches = VERIFIED_MATCHES;

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
              const notes = `משחק ${competitionLabel} - ${m.source_note}. לוודא מקרן וסאונד`;

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
                category: "event",
                event_type: "sports_match",
                event_date: m.event_date,
                start_time: m.start_time ?? null,
                end_time: null,
                notes,
                high_priority: false,
                projector_broadcast: true,
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
