import { useEffect, useState } from "react";
import { Building2, LogOut, ShieldAlert } from "lucide-react";
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
  const { session, isSuperAdmin, realIsSuperAdmin, assignedBranchId, fullName, signOut, loading: authLoading } =
    useAuth();
  const { branches, loading: branchesLoading } = useBranches();
  const activeId = useActiveBranch();

  // Branch Staff: auto-set their assigned branch
  useEffect(() => {
    if (!session?.user?.id) return;
    if (realIsSuperAdmin) return;
    if (assignedBranchId && activeId !== assignedBranchId) {
      setActiveBranchId(assignedBranchId);
    }
  }, [session?.user?.id, realIsSuperAdmin, assignedBranchId, activeId]);


  if (!session?.user?.id) return <>{children}</>;
  if (authLoading || branchesLoading) return null;

  // Branch Staff with no branch assigned → fallback screen
  if (!isSuperAdmin && !assignedBranchId) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 text-center">
        <div className="max-w-md space-y-4 rounded-2xl border border-border bg-card/80 p-6 backdrop-blur">
          <ShieldAlert className="mx-auto h-10 w-10 text-orange-500" />
          <h1 className="text-xl font-bold">לא שויכת לסניף</h1>
          <p className="text-sm text-muted-foreground">
            המשתמש שלך טרם שויך לסניף. פנה להנהלה.
          </p>
          {fullName && (
            <p className="text-xs text-muted-foreground">{fullName}</p>
          )}
          <button
            onClick={signOut}
            className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm hover:bg-background transition"
          >
            <LogOut className="h-4 w-4" /> התנתק
          </button>
        </div>
      </div>
    );
  }

  // Branch Staff with branch assigned → pass through (effect synced activeId)
  if (!isSuperAdmin) {
    if (!activeId) return null;
    return <>{children}</>;
  }

  // Super Admin → must explicitly pick a branch (selection grid)
  if (activeId) return <>{children}</>;

  if (branches.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 text-center">
        <div className="max-w-md space-y-3 rounded-2xl border border-border bg-card/80 p-6 backdrop-blur">
          <Building2 className="mx-auto h-10 w-10 text-neon" />
          <h1 className="text-xl font-bold">לא הוגדרו סניפים</h1>
          <p className="text-sm text-muted-foreground">
            צור את הסניף הראשון מתוך עמוד הניהול.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-2xl space-y-8">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-neon/40 bg-neon/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.3em] text-neon">
            Super Admin
          </div>
          <h1 className="font-display text-3xl font-bold">
            בחר <span className="text-neon text-glow-neon">סניף</span>
          </h1>
          <p className="text-sm text-muted-foreground">
            {fullName ? `שלום ${fullName}, ` : ""}איזה סניף אתה רוצה לנהל כעת?
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {branches.map((b) => (
            <button
              key={b.id}
              onClick={() => setActiveBranchId(b.id)}
              className="group relative overflow-hidden rounded-2xl border-2 border-border bg-card/60 p-6 text-right transition hover:border-neon hover:shadow-[0_0_24px_-4px_rgba(255,20,147,0.6)]"
            >
              <div className="flex items-center justify-between">
                <Building2 className="h-8 w-8 text-neon opacity-80 group-hover:opacity-100 transition" />
                <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground group-hover:text-neon transition">
                  כניסה →
                </div>
              </div>
              <div className="mt-6 text-xl font-bold text-foreground">{b.name}</div>
            </button>
          ))}
        </div>

        <div className="flex justify-center">
          <button
            onClick={signOut}
            className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5"
          >
            <LogOut className="h-3 w-3" /> התנתק
          </button>
        </div>
      </div>
    </div>
  );
}
