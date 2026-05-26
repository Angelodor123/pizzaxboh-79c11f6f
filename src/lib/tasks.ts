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
  ingredient_name: string | null;
  is_purchased_good: boolean;
}

// Common Hebrew operational verbs to strip when deriving a raw-ingredient
// name from a task title. Order matters only for readability — the regex
// uses word-boundary-ish whitespace anchors so partial matches are safe.
const HEBREW_OPERATIONAL_VERBS = [
  "להפריד", "לחתוך", "להכין", "לקצוץ", "לגרר", "לטחון", "לבשל", "לאפות",
  "לטגן", "לערבב", "להקפיא", "להפשיר", "לסנן", "למלא", "לערום", "לסדר",
  "לשטוף", "לנקות", "לקלף", "לפרוס", "לחמם", "להוציא", "לבדוק", "להחליף",
  "לזרוק", "להזמין", "לספור", "למדוד", "לשקול", "להעמיד", "להוריד",
  "להעלות", "לבחוש", "לעטוף", "לארוז", "להגיש",
];

/**
 * Extract a clean raw-ingredient name from a checklist task.
 * Prefers explicit ingredient_name; falls back to stripping operational
 * Hebrew verbs from the task title.
 */
export function extractIngredientName(input: {
  name: string;
  ingredient_name?: string | null;
}): string {
  const explicit = (input.ingredient_name ?? "").trim();
  if (explicit) return explicit;

  let cleaned = input.name;
  for (const verb of HEBREW_OPERATIONAL_VERBS) {
    cleaned = cleaned.replace(new RegExp(`(^|\\s)${verb}(\\s|$)`, "g"), " ");
  }
  // Strip leftover connector words and tidy whitespace/punctuation
  cleaned = cleaned
    .replace(/\b(של|את|עם|ל|מ|ב)\b/g, " ")
    .replace(/[-–—:|,.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || input.name.trim();
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
