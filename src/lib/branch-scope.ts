import { getActiveBranchIdSync } from "./current-branch";

/**
 * Adds a `branch_id = <active>` filter to a Supabase query when an active
 * branch is selected (always true once BranchGate has mounted — both branch
 * staff and super-admins get an active branch id at that point).
 *
 * This guarantees that super-admins (who bypass RLS) only see rows from the
 * currently selected branch, providing full per-branch isolation in the UI.
 */
export function withBranch<T extends { eq: (col: string, val: unknown) => T }>(query: T): T {
  const id = getActiveBranchIdSync();
  return id ? query.eq("branch_id", id) : query;
}

/** Convenience: returns the active branch id or throws — use at write sites. */
export function activeBranchOrNull(): string | null {
  return getActiveBranchIdSync();
}
