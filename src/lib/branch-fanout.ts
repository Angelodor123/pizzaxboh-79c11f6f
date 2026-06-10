import { supabase } from "@/integrations/supabase/client";

/**
 * Branch fan-out helpers — same company, multiple branches.
 * Mutations to "template" tables (recipes, suppliers, tasks, prep, restock)
 * are applied across ALL active branches so the system stays in sync.
 *
 * The user's current branch only affects what they SEE, not what they CHANGE.
 */

let cachedBranchIds: string[] | null = null;
let cachedAt = 0;
const CACHE_TTL_MS = 30_000;

export async function getActiveBranchIds(): Promise<string[]> {
  const now = Date.now();
  if (cachedBranchIds && now - cachedAt < CACHE_TTL_MS) return cachedBranchIds;
  const { data, error } = await supabase
    .from("branches")
    .select("id")
    .eq("active", true)
    .order("created_at", { ascending: true });
  if (error) throw error;
  const ids = (data ?? []).map((b) => b.id as string);
  cachedBranchIds = ids;
  cachedAt = now;
  return ids;
}

export function invalidateBranchCache() {
  cachedBranchIds = null;
}

function slugify(s: string) {
  return (s || "item")
    .toString()
    .normalize("NFKD")
    .replace(/[^\w\u0590-\u05FF]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 40) || "item";
}

/**
 * Insert a row into ALL active branches, generating a unique id per branch.
 * baseRow must NOT contain id or branch_id — those are set per branch.
 */
export async function fanOutInsert<T extends Record<string, unknown>>(
  table: string,
  baseRow: T,
  opts: { naturalKey?: string } = {},
): Promise<void> {
  const branchIds = await getActiveBranchIds();
  if (branchIds.length === 0) return;
  const stamp = Date.now().toString(36);
  const slugBase = opts.naturalKey ? slugify(opts.naturalKey) : "row";
  const rows = branchIds.map((branch_id, idx) => ({
    ...baseRow,
    id: `${slugBase}-${stamp}-${idx}`,
    branch_id,
  }));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await ((supabase as any).from(table)).insert(rows);
  if (error) throw error;
}

/**
 * Update ALL rows that match `matchColumn = matchValue` across every branch.
 * Use for: rename + edit content while keeping the row identity per branch.
 */
export async function fanOutUpdate(
  table: string,
  matchColumn: string,
  matchValue: string,
  changes: Record<string, unknown>,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await ((supabase as any).from(table))
    .update(changes)
    .eq(matchColumn, matchValue);
  if (error) throw error;
}

/**
 * Soft-delete (sets `deleted = true`) all rows matching natural key across branches.
 */
export async function fanOutSoftDelete(
  table: string,
  matchColumn: string,
  matchValue: string,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await ((supabase as any).from(table))
    .update({ deleted: true })
    .eq(matchColumn, matchValue);
  if (error) throw error;
}

/**
 * Hard-delete all rows matching natural key across branches.
 */
export async function fanOutHardDelete(
  table: string,
  matchColumn: string,
  matchValue: string,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await ((supabase as any).from(table))
    .delete()
    .eq(matchColumn, matchValue);
  if (error) throw error;
}

/**
 * Update a single row's siblings across all branches.
 * Looks up the row by id to find its natural key, then updates all rows
 * with the same natural key in every branch.
 */
export async function fanOutUpdateById(
  table: string,
  id: string,
  changes: Record<string, unknown>,
  naturalKeyColumn: string = "name",
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data, error: fetchErr } = await sb
    .from(table)
    .select(naturalKeyColumn)
    .eq("id", id)
    .maybeSingle();
  if (fetchErr) throw fetchErr;
  const keyVal = data?.[naturalKeyColumn];
  if (!keyVal) {
    // Fallback: update by id only
    const { error } = await sb.from(table).update(changes).eq("id", id);
    if (error) throw error;
    return;
  }
  const { error } = await sb
    .from(table)
    .update(changes)
    .eq(naturalKeyColumn, keyVal);
  if (error) throw error;
}

/**
 * Hard-delete a row's siblings across all branches using a natural key lookup.
 */
export async function fanOutDeleteById(
  table: string,
  id: string,
  naturalKeyColumn: string = "name",
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data, error: fetchErr } = await sb
    .from(table)
    .select(naturalKeyColumn)
    .eq("id", id)
    .maybeSingle();
  if (fetchErr) throw fetchErr;
  const keyVal = data?.[naturalKeyColumn];
  if (!keyVal) {
    const { error } = await sb.from(table).delete().eq("id", id);
    if (error) throw error;
    return;
  }
  const { error } = await sb.from(table).delete().eq(naturalKeyColumn, keyVal);
  if (error) throw error;
}
