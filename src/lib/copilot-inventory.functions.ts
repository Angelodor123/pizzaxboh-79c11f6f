import { tool } from "ai";
import { z } from "zod";
import { wrapError } from "./copilot-shared";

export function buildInventoryTools(supabase: any, branchId: string | undefined, userId: string) {
  return {
    // ============ INVENTORY ============
    get_inventory_status: tool({
      description:
        "מחזיר מצב מלאי בזמן אמת: פריטי מלאי כלליים (inventory_items) + עדכון בצקים אחרון (dough_updates_log) + ספירת הכנות (prep_log) להיום.",
      inputSchema: z.object({
        branch_id: z.string().uuid().optional().describe("מזהה סניף; אם לא יסופק - הסניף של המשתמש"),
      }),
      execute: async ({ branch_id }) => {
        const bid = branch_id || branchId;
        try {
          const inv = supabase.from("inventory_items").select("id, name, unit, current_stock, branch_id").order("name").limit(200);
          if (bid) inv.eq("branch_id", bid);
          const dough = supabase
            .from("dough_updates_log")
            .select("trays_count, updated_by_name, created_at, branch_id, prep_item_id")
            .order("created_at", { ascending: false })
            .limit(20);
          if (bid) dough.eq("branch_id", bid);
          const { data: today } = await supabase.rpc("operational_today");
          const prepQ = supabase
            .from("prep_log")
            .select("prep_item_id, current_stock, completed, updated_at")
            .eq("log_date", today as any)
            .limit(200);
          const [invR, doughR, prepR] = await Promise.all([inv, dough, prepQ]);
          if (invR.error) return wrapError(invR.error);
          return {
            inventory_items: invR.data ?? [],
            recent_dough_updates: doughR.data ?? [],
            prep_log_today: prepR.data ?? [],
          };
        } catch (e: any) {
          return wrapError(e);
        }
      },
    }),

    update_inventory_count: tool({
      description:
        "מעדכן כמות מלאי. בחר אחד: (א) עדכון פריט מלאי כללי לפי inventory_item_id או name; (ב) רישום עדכון מיכלי בצק (dough_trays) - מוסיף שורה חדשה ל-dough_updates_log.",
      inputSchema: z.object({
        kind: z.enum(["inventory_item", "dough_trays"]),
        inventory_item_id: z.string().uuid().optional(),
        item_name: z.string().max(120).optional(),
        new_stock: z.number().optional().describe("ערך מלאי חדש (פריט מלאי כללי)"),
        trays_count: z.number().int().min(0).max(10000).optional().describe("מספר מיכלי בצק חדש"),
        branch_id: z.string().uuid().optional(),
      }),
      execute: async ({ kind, inventory_item_id, item_name, new_stock, trays_count, branch_id }) => {
        const bid = branch_id || branchId;
        try {
          if (kind === "dough_trays") {
            if (trays_count == null) return { error: "missing trays_count" };
            if (!bid) return { error: "missing branch_id" };
            // need a prep_item_id (dough). pick first active prep item for branch.
            const { data: prep } = await supabase
              .from("prep_items")
              .select("id, name")
              .eq("branch_id", bid)
              .eq("active", true)
              .ilike("name", "%בצק%")
              .limit(1);
            const prepItemId = prep?.[0]?.id;
            if (!prepItemId) return { error: "no_dough_prep_item", message: "לא מצאתי פריט בצק בסניף." };
            const { data, error } = await supabase
              .from("dough_updates_log")
              .insert({ branch_id: bid, prep_item_id: prepItemId, trays_count, updated_by: userId })
              .select()
              .single();
            if (error) return wrapError(error);
            return { ok: true, updated: data };
          }
          if (kind === "inventory_item") {
            if (new_stock == null) return { error: "missing new_stock" };
            let id = inventory_item_id;
            if (!id) {
              if (!item_name) return { error: "missing item_name or inventory_item_id" };
              const q = supabase.from("inventory_items").select("id").ilike("name", `%${item_name}%`).limit(1);
              if (bid) q.eq("branch_id", bid);
              const { data: found } = await q;
              id = found?.[0]?.id;
              if (!id) return { error: "item_not_found", message: `לא מצאתי פריט בשם "${item_name}".` };
            }
            const { data, error } = await supabase
              .from("inventory_items")
              .update({ current_stock: new_stock })
              .eq("id", id)
              .select()
              .single();
            if (error) return wrapError(error);
            return { ok: true, updated: data };
          }
          return { error: "invalid kind" };
        } catch (e: any) {
          return wrapError(e);
        }
      },
    }),
  };
}
