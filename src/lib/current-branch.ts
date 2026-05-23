import { supabase } from "@/integrations/supabase/client";

let cached: string | null = null;
let inflight: Promise<string | null> | null = null;

export async function getCurrentBranchId(): Promise<string | null> {
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
  if (!id) throw new Error("המשתמש שלך טרם שויך לסניף. פנה להנהלה.");
  return id;
}

export function clearBranchCache() {
  cached = null;
  inflight = null;
}
