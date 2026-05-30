import { getActiveBranchIdSync } from "./current-branch";

/**
 * Adds a `branch_id = <active>` filter to a Supabase query when an active
 * branch is selected. Use on SELECT queries against branch-scoped tables to
 * guarantee per-branch isolation in the UI (including for super-admins who
 * bypass RLS).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function withBranch<T>(query: T): T {
  const id = getActiveBranchIdSync();
  if (!id) return query;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (query as any).eq("branch_id", id) as T;
}
