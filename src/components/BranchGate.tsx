import { useEffect, useState } from "react";
import { Building2, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import {
  getActiveBranchIdSync,
  setActiveBranchId,
  subscribeBranch,
} from "@/lib/current-branch";

type Branch = { id: string; name: string };

export function useBranches() {
  const { session } = useAuth();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session?.user?.id) {
      setBranches([]);
      setLoading(false);
      return;
    }
    let mounted = true;
    (async () => {
      const { data } = await supabase
        .from("branches")
        .select("id, name")
        .eq("active", true)
        .order("name");
      if (!mounted) return;
      setBranches((data as Branch[]) ?? []);
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, [session?.user?.id]);

  return { branches, loading };
}

export function useActiveBranch() {
  const [id, setId] = useState<string | null>(() => getActiveBranchIdSync());
  useEffect(() => subscribeBranch(setId), []);
  return id;
}

export function BranchGate({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  const { branches, loading } = useBranches();
  const activeId = useActiveBranch();

  // Auto-select if only one branch exists
  useEffect(() => {
    if (!activeId && branches.length === 1) {
      setActiveBranchId(branches[0].id);
    }
  }, [activeId, branches]);

  // No session yet — nothing to gate
  if (!session?.user?.id) return <>{children}</>;
  if (loading) return null;

  if (activeId) return <>{children}</>;

  if (branches.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 text-center">
        <div className="max-w-md space-y-3">
          <Building2 className="mx-auto h-10 w-10 text-neon" />
          <h1 className="text-xl font-bold">לא הוגדרו סניפים</h1>
          <p className="text-sm text-muted-foreground">פנה להנהלה כדי להוסיף סניף.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card/80 p-6 backdrop-blur space-y-5">
        <div className="text-center space-y-2">
          <Building2 className="mx-auto h-10 w-10 text-neon" />
          <h1 className="text-xl font-bold">בחר סניף</h1>
          <p className="text-sm text-muted-foreground">
            כדי להמשיך, בחר את הסניף שבו אתה עובד כעת.
          </p>
        </div>
        <div className="space-y-2">
          {branches.map((b) => (
            <button
              key={b.id}
              onClick={() => setActiveBranchId(b.id)}
              className="w-full rounded-lg border border-border bg-background/60 px-4 py-3 text-right font-semibold hover:border-neon hover:text-neon transition flex items-center justify-between"
            >
              <span>{b.name}</span>
              <Check className="h-4 w-4 opacity-0" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
