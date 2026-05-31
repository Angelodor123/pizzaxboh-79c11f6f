import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getActiveBranchIdSync, subscribeBranch } from "@/lib/current-branch";

const cache = new Map<string, string>();

/** Returns the display name of the user's currently active branch, or null. */
export function useActiveBranchName(): string | null {
  const [id, setId] = useState<string | null>(() => getActiveBranchIdSync());
  const [name, setName] = useState<string | null>(() =>
    id ? cache.get(id) ?? null : null,
  );

  useEffect(() => {
    const unsub = subscribeBranch((next) => setId(next));
    return unsub;
  }, []);

  useEffect(() => {
    if (!id) {
      setName(null);
      return;
    }
    const hit = cache.get(id);
    if (hit) {
      setName(hit);
      return;
    }
    let alive = true;
    supabase
      .from("branches")
      .select("name")
      .eq("id", id)
      .maybeSingle()
      .then(({ data }) => {
        if (!alive) return;
        const n = (data?.name as string | undefined) ?? null;
        if (n) cache.set(id, n);
        setName(n);
      });
    return () => {
      alive = false;
    };
  }, [id]);

  return name;
}

/** True when the active branch is "מודיעין". */
export function useIsModiinBranch(): boolean {
  const name = useActiveBranchName();
  return name === "מודיעין";
}
