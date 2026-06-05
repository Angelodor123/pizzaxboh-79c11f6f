import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type DailyBriefing = {
  greeting: string;
  userName: string;
  timeOfDay: "morning" | "noon" | "evening";
  shortagesCount: number;
  deliveriesToday: string[];
  eventsToday: string[];
  shiftFeedToday: number;
  summaryText: string;
};

export const getDailyBriefing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DailyBriefing> => {
    const { supabase, userId } = context as { supabase: any; userId: string };

    const hour = new Date().getHours();
    const timeOfDay: DailyBriefing["timeOfDay"] =
      hour >= 5 && hour < 12 ? "morning" : hour >= 12 && hour < 18 ? "noon" : "evening";
    const greeting =
      timeOfDay === "morning" ? "בוקר טוב" : timeOfDay === "noon" ? "צהריים טובים" : "ערב טוב";

    // user name + branch
    const profileQ = supabase.from("profiles").select("full_name").eq("user_id", userId).maybeSingle();
    const branchQ = supabase.rpc("current_user_branch_id");
    const [profileR, branchR] = await Promise.all([profileQ, branchQ]);
    const userName = (profileR.data?.full_name as string | undefined)?.split(" ")[0] || "אחי";
    const branchId = (branchR.data as string | null) ?? null;

    // Today range in Asia/Jerusalem
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);
    const todayDow = new Date().getDay();

    // shortages
    let shortageQ = supabase
      .from("shortage_items")
      .select("id", { count: "exact", head: true })
      .eq("completed", false);
    if (branchId) shortageQ = shortageQ.eq("branch_id", branchId);
    const { count: shortagesCount } = await shortageQ;

    // deliveries today (invoices received today)
    let invoicesQ = supabase
      .from("invoices")
      .select("supplier_name, scanned_at")
      .gte("scanned_at", todayStart.toISOString())
      .lte("scanned_at", todayEnd.toISOString())
      .limit(20);
    if (branchId) invoicesQ = invoicesQ.eq("branch_id", branchId);
    const { data: invoices } = await invoicesQ;
    const deliveriesToday = Array.from(
      new Set(((invoices ?? []) as any[]).map((i) => i.supplier_name).filter(Boolean)),
    );

    // calendar events today (one-off + recurring by weekday)
    let oneOffQ = supabase
      .from("calendar_events")
      .select("title, category, high_priority")
      .gte("event_date", todayStart.toISOString().slice(0, 10))
      .lte("event_date", todayEnd.toISOString().slice(0, 10))
      .limit(20);
    let recurringQ = supabase
      .from("calendar_events")
      .select("title, category, high_priority, supplier")
      .eq("recurring_weekday", todayDow)
      .limit(20);
    if (branchId) {
      oneOffQ = oneOffQ.eq("branch_id", branchId);
      recurringQ = recurringQ.eq("branch_id", branchId);
    }
    const [oneOffR, recurringR] = await Promise.all([oneOffQ, recurringQ]);
    const eventsToday = Array.from(
      new Set([
        ...((oneOffR.data ?? []) as any[]).map((e) => e.title),
        ...((recurringR.data ?? []) as any[])
          .filter((e) => e.category !== "delivery") // already covered by deliveries
          .map((e) => e.title),
      ]),
    ).slice(0, 5);

    // shift feed today
    let feedQ = supabase
      .from("shift_feed")
      .select("id", { count: "exact", head: true })
      .gte("created_at", todayStart.toISOString());
    if (branchId) feedQ = feedQ.eq("branch_id", branchId);
    const { count: feedCount } = await feedQ;

    const lines: string[] = [];
    lines.push(`${greeting} ${userName}! 🍕 הנה תמונת המצב להיום:`);
    if (deliveriesToday.length > 0) {
      lines.push(`📦 סחורה: התקבלו משלוחים מ-${deliveriesToday.slice(0, 3).join(", ")}.`);
    } else {
      lines.push("📦 סחורה: אין משלוחים שתועדו עדיין היום.");
    }
    lines.push(
      `⚠️ חוסרים פתוחים: ${shortagesCount ?? 0} ${(shortagesCount ?? 0) === 1 ? "פריט" : "פריטים"}.`,
    );
    if (eventsToday.length > 0) {
      lines.push(`📅 אירועים: ${eventsToday.join(", ")}.`);
    }
    if ((feedCount ?? 0) > 0) {
      lines.push(`💬 פיד משמרת: ${feedCount} עדכונים היום.`);
    }
    lines.push("איך אפשר לעזור לך במשמרת? ✌️");

    return {
      greeting,
      userName,
      timeOfDay,
      shortagesCount: shortagesCount ?? 0,
      deliveriesToday,
      eventsToday,
      shiftFeedToday: feedCount ?? 0,
      summaryText: lines.join("\n"),
    };
  });
