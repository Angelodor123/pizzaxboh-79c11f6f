import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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
    competition: "champions_league" as const,
    event_date: "2026-05-30",
    start_time: "19:00",
    source_note: "אומת מול צילום מסך Google שסופק ומול עמוד המשחקים הרשמי של UEFA",
  },
];

export const syncSportsEvents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: role } = await context.supabase.rpc("current_user_role");
    if (role !== "admin") throw new Error("Unauthorized");

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

    const matches = VERIFIED_MATCHES;
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
      const notes = `משחק ${competitionLabel} - ${m.source_note}. לוודא מקרן וסאונד`;

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

    return {
      ok: true,
      inserted,
      skipped,
      total: matches.length,
    };
  });
