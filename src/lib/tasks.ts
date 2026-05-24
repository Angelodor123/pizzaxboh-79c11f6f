import { supabase } from "@/integrations/supabase/client";

export interface Shift {
  id: string;
  branch_id: string;
  name: string;
  sort_order: number;
  active: boolean;
}

export interface TaskGroup {
  id: string;
  branch_id: string;
  shift_id: string;
  name: string;
  sort_order: number;
  active: boolean;
}

export interface Task {
  id: string;
  branch_id: string;
  group_id: string;
  name: string;
  sort_order: number;
  active: boolean;
  recipe_id: string | null;
  prep_item_id: string | null;
}

export interface DailyTaskLog {
  id: string;
  branch_id: string;
  task_id: string;
  log_date: string;
  completed: boolean;
  completed_at: string | null;
  completed_by: string | null;
  completed_by_user_id: string | null;
  comments: string;
}

export async function fetchTaskTree(branchId: string) {
  const [{ data: shifts }, { data: groups }, { data: tasks }] = await Promise.all([
    supabase
      .from("shifts")
      .select("*")
      .eq("branch_id", branchId)
      .eq("active", true)
      .order("sort_order"),
    supabase
      .from("task_groups")
      .select("*")
      .eq("branch_id", branchId)
      .eq("active", true)
      .order("sort_order"),
    supabase
      .from("tasks")
      .select("*")
      .eq("branch_id", branchId)
      .eq("active", true)
      .order("sort_order"),
  ]);
  return {
    shifts: (shifts ?? []) as Shift[],
    groups: (groups ?? []) as TaskGroup[],
    tasks: (tasks ?? []) as Task[],
  };
}

export async function fetchTodayLogs(branchId: string): Promise<DailyTaskLog[]> {
  const { data: today } = await supabase.rpc("operational_today");
  const { data } = await supabase
    .from("daily_task_logs")
    .select("*")
    .eq("branch_id", branchId)
    .eq("log_date", today as string);
  return (data ?? []) as DailyTaskLog[];
}

export interface UpsertLogInput {
  branch_id: string;
  task_id: string;
  log_date: string;
  completed: boolean;
  completed_at: string | null;
  completed_by: string | null;
  completed_by_user_id: string | null;
  comments: string;
}

export async function upsertLogs(rows: UpsertLogInput[]) {
  if (rows.length === 0) return;
  const { error } = await supabase
    .from("daily_task_logs")
    .upsert(rows, { onConflict: "task_id,log_date" });
  if (error) throw error;
}
