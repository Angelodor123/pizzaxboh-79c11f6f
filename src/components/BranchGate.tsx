import { useEffect, useState } from "react";
import { Building2, LogOut, ShieldAlert, MapPin, Wheat } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import {
  getActiveBranchIdSync,
  setActiveBranchId,
  subscribeBranch,
} from "@/lib/current-branch";

type Branch = {
  id: string;
  name: string;
  address: string | null;
  image_url: string | null;
  latitude: number | null;
  longitude: number | null;
  features: Record<string, unknown> | null;
};

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
        .select("id, name, address, image_url, latitude, longitude, features")
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

/** Returns the active branch object (with features, coords, etc.) */
export function useActiveBranchData(): Branch | null {
  const activeId = useActiveBranch();
  const { branches } = useBranches();
  return branches.find((b) => b.id === activeId) ?? null;
}

/** Returns whether the active branch has a feature enabled (default: true if unset). */
export function useBranchFeature(key: string, defaultValue = true): boolean {
  const active = useActiveBranchData();
  const features = (active?.features ?? {}) as Record<string, unknown>;
  if (!(key in features)) return defaultValue;
  return Boolean(features[key]);
}

function NetworkKpiBanner() {
  const [total, setTotal] = useState<number | null>(null);
  const [perBranch, setPerBranch] = useState<{ branch_name: string; total_trays: number }[]>([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data, error } = await supabase.rpc("network_dough_summary");
      if (!mounted || error) return;
      const rows = (data as { branch_name: string; total_trays: number }[] | null) ?? [];
      setPerBranch(rows);
      setTotal(rows.reduce((sum, r) => sum + Number(r.total_trays ?? 0), 0));
    })();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="relative overflow-hidden rounded-2xl border-2 border-neon/40 bg-gradient-to-br from-neon/10 via-card/80 to-card p-6 shadow-[0_0_32px_-8px_rgba(255,20,147,0.5)]">
      <div className="absolute -top-12 -right-12 h-40 w-40 rounded-full bg-neon/20 blur-3xl" />
      <div className="relative flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-neon/15 border border-neon/40 p-3">
            <Wheat className="h-7 w-7 text-neon" />
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-neon">
              Network KPI
            </div>
            <div className="font-display text-sm font-semibold text-muted-foreground mt-1">
              סה״כ מגשי בצק ברשת
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="font-display text-5xl font-black text-foreground tabular-nums leading-none">
            {total === null ? "—" : total}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">מגשים פעילים</div>
        </div>
      </div>
      {perBranch.length > 0 && (
        <div className="relative mt-4 pt-4 border-t border-border/60 flex flex-wrap gap-x-5 gap-y-1.5 text-[11px]">
          {perBranch.map((r) => (
            <div key={r.branch_name} className="text-muted-foreground">
              {r.branch_name}: <span className="text-foreground font-semibold tabular-nums">{r.total_trays}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function BranchGate({ children }: { children: React.ReactNode }) {
  const { session, realIsSuperAdmin, assignedBranchId, fullName, signOut, loading: authLoading } =
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
  if (!realIsSuperAdmin && !assignedBranchId) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 text-center">
        <div className="max-w-md space-y-4 rounded-2xl border border-border bg-card/80 p-6 backdrop-blur">
          <ShieldAlert className="mx-auto h-10 w-10 text-orange-500" />
          <h1 className="text-xl font-bold">לא שויכת לסניף</h1>
          <p className="text-sm text-muted-foreground">
            המשתמש שלך טרם שויך לסניף. פנה להנהלה.
          </p>
          {fullName && <p className="text-xs text-muted-foreground">{fullName}</p>}
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

  // Branch Staff → pass through (effect synced activeId)
  if (!realIsSuperAdmin) {
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
    <div className="min-h-screen px-4 py-10 flex flex-col items-center">
      <div className="w-full max-w-4xl space-y-8">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-neon/40 bg-neon/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.3em] text-neon">
            Regional Super Admin
          </div>
          <h1 className="font-display text-3xl font-bold">
            לוח <span className="text-neon text-glow-neon">בקרה רשתי</span>
          </h1>
          <p className="text-sm text-muted-foreground">
            {fullName ? `שלום ${fullName}, ` : ""}בחר סניף לכניסה
          </p>
        </div>

        <NetworkKpiBanner />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {branches.map((b) => (
            <button
              key={b.id}
              onClick={() => setActiveBranchId(b.id)}
              className="group relative overflow-hidden rounded-2xl border-2 border-border bg-card text-right transition hover:border-neon hover:shadow-[0_0_28px_-4px_rgba(255,20,147,0.6)] aspect-[4/3] min-h-[260px]"
            >
              {b.image_url ? (
                <img
                  src={b.image_url}
                  alt={b.name}
                  className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105"
                  loading="lazy"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-card to-background">
                  <Building2 className="h-16 w-16 text-neon/40" />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-black/20" />
              <div className="relative h-full flex flex-col justify-between p-5">
                <div className="flex justify-end">
                  <div className="rounded-full bg-neon/90 text-primary-foreground text-[10px] font-bold uppercase tracking-widest px-3 py-1 opacity-0 group-hover:opacity-100 transition">
                    כניסה →
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="font-display text-2xl font-black text-white drop-shadow-lg">
                    {b.name}
                  </div>
                  {b.address && (
                    <div className="flex items-center gap-1.5 text-sm text-white/85">
                      <MapPin className="h-3.5 w-3.5" />
                      <span>{b.address}</span>
                    </div>
                  )}
                </div>
              </div>
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
