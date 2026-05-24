import { supabase } from "@/integrations/supabase/client";

const STORAGE_KEY = "pizzax-active-branch-id";

let cached: string | null = null;
let inflight: Promise<string | null> | null = null;
const listeners = new Set<(id: string | null) => void>();

function readStorage(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export async function getCurrentBranchId(): Promise<string | null> {
  const fromStorage = readStorage();
  if (fromStorage) {
    cached = fromStorage;
    return fromStorage;
  }
  if (cached) return cached;
  if (inflight) return inflight;
  inflight = (async () => {
    const { data, error } = await supabase.rpc("current_user_branch_id");
    if (error) {
      inflight = null;
      return null;
    }
    cached = (data as string | null) ?? null;
    inflight = null;
    return cached;
  })();
  return inflight;
}

export async function requireCurrentBranchId(): Promise<string> {
  const id = await getCurrentBranchId();
  if (!id) throw new Error("יש לבחור סניף לפני ביצוע הפעולה.");
  return id;
}

export function setActiveBranchId(id: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (id) localStorage.setItem(STORAGE_KEY, id);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* noop */
  }
  cached = id;
  inflight = null;
  listeners.forEach((fn) => fn(id));
}

export function getActiveBranchIdSync(): string | null {
  return readStorage() ?? cached;
}

export function subscribeBranch(fn: (id: string | null) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function clearBranchCache() {
  cached = null;
  inflight = null;
}
