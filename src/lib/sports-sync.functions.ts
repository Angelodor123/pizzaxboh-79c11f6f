import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { extractMatchesFromRss } from "@/lib/sports-rss.server";

export const syncSportsEvents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: role } = await context.supabase.rpc("current_user_role");
    if (role !== "admin") throw new Error("Unauthorized");

    const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
    if (!LOVABLE_API_KEY) throw new Error("Missing LOVABLE_API_KEY");

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

    const { matches, feedsTried, itemsScanned } = await extractMatchesFromRss(LOVABLE_API_KEY);

    let inserted = 0;
    let skipped = 0;

    for (const m of matches) {
      const title = `שידור משחק: ${m.team_a} vs ${m.team_b}`;
      const competitionLabel =
        m.competition === "world_cup" ? "מונדיאל FIFA 2026" : "ליגת האלופות";
      const notes = `${competitionLabel} • מקור: ${m.source_title || m.source_url}. לוודא מקרן וסאונד.`;

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
        category: "event",
        event_type: "sports_match",
        event_date: m.event_date,
        start_time: m.start_time,
        end_time: null,
        notes,
        high_priority: true,
        projector_broadcast: true,
        is_auto: true,
      });
      if (!error) inserted++;
    }

    return {
      ok: true,
      inserted,
      skipped,
      matches_found: matches.length,
      feeds_tried: feedsTried,
      items_scanned: itemsScanned,
    };
  });
