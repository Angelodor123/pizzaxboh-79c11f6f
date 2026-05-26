import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { extractMatchesFromRss } from "@/lib/sports-rss.server";
import { extractMatchesViaFirecrawl } from "@/lib/sports-firecrawl.server";

export const Route = createFileRoute("/api/public/hooks/sports-sync")({
  server: {
    handlers: {
      POST: async () => {
        try {
          const SUPABASE_URL = process.env.SUPABASE_URL!;
          const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
          const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY!;
          if (!SUPABASE_URL || !SERVICE) {
            return Response.json({ ok: false, error: "missing supabase env" }, { status: 500 });
          }
          if (!LOVABLE_API_KEY) {
            return Response.json({ ok: false, error: "missing LOVABLE_API_KEY" }, { status: 500 });
          }

          const supabase = createClient<Database>(SUPABASE_URL, SERVICE, {
            auth: { persistSession: false, autoRefreshToken: false },
          });

          const { matches, feedsTried, itemsScanned } = await extractMatchesFromRss(LOVABLE_API_KEY);

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
                m.competition === "world_cup" ? "מונדיאל FIFA 2026" : "ליגת האלופות";
              const notes = `${competitionLabel} • מקור: ${m.source_title || m.source_url}. לוודא מקרן וסאונד.`;

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
                start_time: m.start_time,
                end_time: null,
                notes,
                high_priority: m.competition === "world_cup" || m.competition === "champions_league",
                projector_broadcast: true,
                is_auto: true,
              });
              if (!error) inserted++;
            }
          }

          return Response.json({
            ok: true,
            inserted,
            skipped,
            matches_found: matches.length,
            feeds_tried: feedsTried,
            items_scanned: itemsScanned,
          });
        } catch (e) {
          console.error("sports-sync error", e);
          return Response.json({ ok: false, error: String(e) }, { status: 500 });
        }
      },
    },
  },
});
