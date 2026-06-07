// Central registration of offline-queue handlers for critical mutations.
// Imported once from the app root so handlers exist before any UI mounts.
import { supabase } from "@/integrations/supabase/client";
import { registerQueueHandler } from "./offline-queue";
import { upsertLogs, type UpsertLogInput } from "./tasks";

// Kinds — keep stable; persisted in localStorage queue.
export const QK = {
  TaskLogUpsert: "task.log.upsert",
  DoughLogInsert: "dough.log.insert",
  PrepLogUpsert: "prep.log.upsert",
  RestockLogUpsert: "restock.log.upsert",
  ComplaintInsert: "complaint.insert",
} as const;

export type DoughLogInsertPayload = {
  rows: Array<{
    branch_id: string;
    prep_item_id: string;
    updated_by: string | null;
    updated_by_name: string | null;
    trays_count: number;
    location: "shop" | "southern_freezer" | "southern_fridge";
  }>;
};

export type PrepLogUpsertPayload = {
  row: {
    prep_item_id: string;
    log_date: string;
    current_stock: number;
    completed: boolean;
    updated_by: string | null;
  };
};

export type RestockLogUpsertPayload = {
  row: {
    restock_item_id: string;
    log_date: string;
    current_stock: number;
    completed: boolean;
    updated_by: string | null;
  };
};

export type ComplaintInsertPayload = {
  row: {
    created_by: string;
    branch_id: string | null;
    customer_name: string;
    phone_number: string;
    address: string | null;
    description: string;
    order_date: string | null;
    order_number: string | null;
  };
};

let registered = false;

export function registerOfflineHandlers() {
  if (registered) return;
  registered = true;

  registerQueueHandler(QK.TaskLogUpsert, async (payload) => {
    const rows = (payload as { rows: UpsertLogInput[] })?.rows ?? [];
    if (rows.length) await upsertLogs(rows);
  });

  registerQueueHandler(QK.DoughLogInsert, async (payload) => {
    const rows = (payload as DoughLogInsertPayload)?.rows ?? [];
    if (!rows.length) return;
    const { error } = await supabase.from("dough_updates_log").insert(rows);
    if (error) throw error;
  });

  registerQueueHandler(QK.PrepLogUpsert, async (payload) => {
    const row = (payload as PrepLogUpsertPayload)?.row;
    if (!row) return;
    const { error } = await supabase
      .from("prep_log")
      .upsert(row, { onConflict: "prep_item_id,log_date" });
    if (error) throw error;
  });

  registerQueueHandler(QK.RestockLogUpsert, async (payload) => {
    const row = (payload as RestockLogUpsertPayload)?.row;
    if (!row) return;
    const { error } = await supabase
      .from("restock_log")
      .upsert(row, { onConflict: "restock_item_id,log_date" });
    if (error) throw error;
  });

  registerQueueHandler(QK.ComplaintInsert, async (payload) => {
    const row = (payload as ComplaintInsertPayload)?.row;
    if (!row) return;
    const { error } = await supabase.from("customer_complaints").insert(row);
    if (error) throw error;
  });
}
