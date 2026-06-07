// Central registration of offline-queue handlers for critical mutations.
// Imported once from the app root so handlers exist before any UI mounts.
import { supabase } from "@/integrations/supabase/client";
import { registerQueueHandler } from "./offline-queue";
import { upsertLogs, type UpsertLogInput } from "./tasks";

// Kinds — keep stable; persisted in localStorage queue.
export const QK = {
  TaskLogUpsert: "task.log.upsert",
  DoughLogInsert: "dough.log.insert",
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
}
