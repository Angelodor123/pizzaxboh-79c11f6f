import { tool } from "ai";
import { z } from "zod";
import { wrapError } from "./copilot-shared";

export function buildPrepTools(supabase: any, branchId: string | undefined, userId: string) {
  return {
    // ============ DAILY PREP ============
    get_daily_prep_targets: tool({
      description:
        "מחזיר את יעדי ההכנות היומיות (prep_items) של היום לפי יום בשבוע, יחד עם סטטוס המלאי הנוכחי וסיום (prep_log).",
      inputSchema: z.object({
        branch_id: z.string().uuid().optional(),
      }),
      execute: async ({ branch_id }) => {
        const bid = branch_id || branchId;
        try {
          const { data: today } = await supabase.rpc("operational_today");
          const weekdayCols = ["target_sun","target_mon","target_tue","target_wed","target_thu","target_fri","target_sat"];
          const dow = new Date(String(today)).getDay();
          const targetCol = weekdayCols[dow];

          const itemsQ = supabase
            .from("prep_items")
            .select(`id, name, unit, ${targetCol}, branch_id`)
            .eq("active", true)
            .order("sort_order")
            .limit(200);
          if (bid) itemsQ.eq("branch_id", bid);

          const logQ = supabase
            .from("prep_log")
            .select("prep_item_id, current_stock, completed, updated_at")
            .eq("log_date", today as any)
            .limit(500);

          const [itemsR, logR] = await Promise.all([itemsQ, logQ]);
          if (itemsR.error) return wrapError(itemsR.error);
          const items = itemsR.data ?? [];
          const logs = logR.data ?? [];
          const rows = items.map((it: any) => {
            const l = logs.find((x: any) => x.prep_item_id === it.id);
            const target = Number(it[targetCol] ?? 0);
            const stock = Number(l?.current_stock ?? 0);
            return {
              id: it.id,
              name: it.name,
              unit: it.unit,
              target_today: target,
              current_stock: stock,
              completed: !!l?.completed,
              missing: Math.max(0, target - stock),
              updated_at: l?.updated_at ?? null,
            };
          });
          const total = rows.length;
          const done = rows.filter((r: any) => r.completed).length;
          return {
            date: today,
            weekday: dow,
            total_items: total,
            completed_items: done,
            percent: total ? Math.round((done / total) * 100) : 0,
            items: rows,
          };
        } catch (e: any) {
          return wrapError(e);
        }
      },
    }),

    update_prep_quantity: tool({
      description:
        "מעדכן כמות שהוכנה היום עבור פריט הכנה (prep_item). יוצר/מעדכן רשומה ב-prep_log לפי prep_item_id (או prep_item_name) ולתאריך התפעולי של היום.",
      inputSchema: z.object({
        prep_item_id: z.string().uuid().optional(),
        prep_item_name: z.string().max(120).optional(),
        current_stock: z.number().min(0).describe("כמות מלאי/שהוכנה כעת"),
        completed: z.boolean().optional(),
        branch_id: z.string().uuid().optional(),
      }),
      execute: async ({ prep_item_id, prep_item_name, current_stock, completed, branch_id }) => {
        const bid = branch_id || branchId;
        try {
          let id = prep_item_id;
          if (!id) {
            if (!prep_item_name) return { error: "missing prep_item_id or prep_item_name" };
            const q = supabase.from("prep_items").select("id").ilike("name", `%${prep_item_name}%`).limit(1);
            if (bid) q.eq("branch_id", bid);
            const { data: found } = await q;
            id = found?.[0]?.id;
            if (!id) return { error: "prep_item_not_found", message: `לא מצאתי הכנה בשם "${prep_item_name}".` };
          }
          const { data: today } = await supabase.rpc("operational_today");
          const payload: any = { prep_item_id: id, log_date: today, current_stock, updated_by: userId, updated_at: new Date().toISOString() };
          if (completed != null) payload.completed = completed;

          // try update first
          const upd = await supabase
            .from("prep_log")
            .update(payload)
            .eq("prep_item_id", id)
            .eq("log_date", today as any)
            .select();
          if (upd.error) return wrapError(upd.error);
          if (upd.data && upd.data.length) return { ok: true, updated: upd.data[0] };

          const ins = await supabase.from("prep_log").insert(payload).select().single();
          if (ins.error) return wrapError(ins.error);
          return { ok: true, inserted: ins.data };
        } catch (e: any) {
          return wrapError(e);
        }
      },
    }),
  };
}
