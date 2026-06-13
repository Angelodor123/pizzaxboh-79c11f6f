import { tool } from "ai";
import { z } from "zod";
import { wrapError } from "./copilot-shared";

export function buildCalendarTools(supabase: any, branchId: string | undefined, userId: string) {
  return {
    // ============ CALENDAR ============
    get_upcoming_events: tool({
      description: "מחזיר אירועים מלוח השנה (calendar_events) לטווח ימים שצוין.",
      inputSchema: z.object({
        branch_id: z.string().uuid().optional(),
        days_ahead: z.number().int().min(1).max(60).default(7),
      }),
      execute: async ({ branch_id, days_ahead }) => {
        const bid = branch_id || branchId;
        try {
          const now = new Date();
          const end = new Date(now.getTime() + days_ahead * 86400000);
          const q = supabase
            .from("calendar_events")
            .select("id, title, category, event_date, start_time, end_time, supplier, recurring_weekday, high_priority, notes, branch_id")
            .or(`event_date.gte.${now.toISOString().slice(0, 10)},recurring_weekday.not.is.null`)
            .lte("event_date", end.toISOString().slice(0, 10))
            .limit(200);
          if (bid) q.eq("branch_id", bid);
          const { data, error } = await q;
          if (error) return wrapError(error);
          return { events: data ?? [], range: { from: now.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) } };
        } catch (e: any) {
          return wrapError(e);
        }
      },
    }),

    add_calendar_event: tool({
      description: "מוסיף אירוע תפעולי חדש ללוח השנה (calendar_events). דרוש: title, category, event_date או recurring_weekday.",
      inputSchema: z.object({
        title: z.string().min(1).max(200),
        category: z.string().min(1).max(60).describe("קטגוריה, למשל: delivery, meeting, maintenance"),
        event_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("תאריך חד-פעמי YYYY-MM-DD"),
        recurring_weekday: z.number().int().min(0).max(6).optional().describe("0=ראשון..6=שבת לאירועים חוזרים"),
        start_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).optional(),
        end_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).optional(),
        notes: z.string().max(1000).optional(),
        high_priority: z.boolean().optional(),
        branch_id: z.string().uuid().optional(),
      }),
      execute: async (input) => {
        const bid = input.branch_id || branchId;
        if (!bid) return { error: "missing branch_id" };
        if (!input.event_date && input.recurring_weekday == null) {
          return { error: "missing_date", message: "צריך event_date או recurring_weekday." };
        }
        try {
          const { data, error } = await supabase
            .from("calendar_events")
            .insert({
              branch_id: bid,
              title: input.title,
              category: input.category,
              event_date: input.event_date ?? null,
              recurring_weekday: input.recurring_weekday ?? null,
              start_time: input.start_time ?? null,
              end_time: input.end_time ?? null,
              notes: input.notes ?? null,
              high_priority: input.high_priority ?? false,
              is_auto: false,
              created_by: userId,
            })
            .select()
            .single();
          if (error) return wrapError(error);
          return { ok: true, event: data };
        } catch (e: any) {
          return wrapError(e);
        }
      },
    }),
  };
}
