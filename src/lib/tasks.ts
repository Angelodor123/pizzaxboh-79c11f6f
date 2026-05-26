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
  requires_photo: boolean;
  parent_task_id: string | null;
}

// Common Hebrew operational verbs to strip when deriving a raw-ingredient
// name from a task title.
const HEBREW_OPERATIONAL_VERBS = [
  "להפריד", "לחתוך", "להכין", "לקצוץ", "לגרר", "לטחון", "לבשל", "לאפות",
  "לטגן", "לערבב", "להקפיא", "להפשיר", "לסנן", "למלא", "לערום", "לסדר",
  "לשטוף", "לנקות", "לקלף", "לפרוס", "לחמם", "להוציא", "לבדוק", "להחליף",
  "לזרוק", "להזמין", "לספור", "למדוד", "לשקול", "להעמיד", "להוריד",
  "להעלות", "לבחוש", "לעטוף", "לארוז", "להגיש",
];

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
  photo_url: string | null;
}

export async function fetchTaskTree(branchId: string) {
  const [{ data: shifts }, { data: groups }, { data: tasks }] = await Promise.all([
    supabase.from("shifts").select("*").eq("branch_id", branchId).eq("active", true).order("sort_order"),
    supabase.from("task_groups").select("*").eq("branch_id", branchId).eq("active", true).order("sort_order"),
    supabase.from("tasks").select("*").eq("branch_id", branchId).eq("active", true).order("sort_order"),
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
  photo_url?: string | null;
}

export async function upsertLogs(rows: UpsertLogInput[]) {
  if (rows.length === 0) return;
  const { error } = await supabase
    .from("daily_task_logs")
    .upsert(rows, { onConflict: "task_id,log_date" });
  if (error) throw error;
}

const TASK_PHOTOS_BUCKET = "task-photos";

/**
 * Upload a photo for a task completion. Returns the storage path
 * (stored in `daily_task_logs.photo_url`) and a freshly-signed URL.
 */
export async function uploadTaskPhoto(
  file: File,
  opts: { branchId: string; taskId: string; userId: string | null },
): Promise<{ path: string; signedUrl: string }> {
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().slice(0, 5);
  const stamp = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  const path = `${opts.branchId}/${opts.taskId}/${stamp}-${rand}.${ext}`;

  const { error: uploadErr } = await supabase.storage
    .from(TASK_PHOTOS_BUCKET)
    .upload(path, file, { upsert: false, contentType: file.type || "image/jpeg" });
  if (uploadErr) throw uploadErr;

  const signed = await getTaskPhotoSignedUrl(path);
  return { path, signedUrl: signed ?? "" };
}

export async function getTaskPhotoSignedUrl(
  path: string,
  expiresInSeconds = 3600,
): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await supabase.storage
    .from(TASK_PHOTOS_BUCKET)
    .createSignedUrl(path, expiresInSeconds);
  if (error) return null;
  return data?.signedUrl ?? null;
}
