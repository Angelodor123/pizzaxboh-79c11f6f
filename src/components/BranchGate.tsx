import { useEffect, useMemo, useState } from "react";
import {
  Building2,
  LogOut,
  ShieldAlert,
  MapPin,
  Wheat,
  CheckCircle2,
  AlertTriangle,
  Wrench,
} from "lucide-react";
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

type BranchStats = {
  dough: number;
  tasksTotal: number;
  tasksDone: number;
  openTickets: number;
  criticalTickets: number;
  shortages: number;
};

function NetworkKpiBanner() {
  const { branches } = useBranches();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Record<string, BranchStats>>({});

  useEffect(() => {
    let mounted = true;
    (async () => {
      const today = new Date().toISOString().slice(0, 10);
      const [doughRes, tasksRes, logsRes, ticketsRes, shortagesRes] = await Promise.all([
        supabase.rpc("network_dough_summary"),
        supabase.from("tasks").select("id, branch_id").eq("active", true),
        supabase
          .from("daily_task_logs")
          .select("task_id, branch_id, completed")
          .eq("log_date", today)
          .eq("completed", true),
        supabase
          .from("maintenance_tickets")
          .select("branch_id, urgency, is_read_by_admin, status")
          .eq("status", "open")
          .eq("is_read_by_admin", false),
        supabase.from("shortage_items").select("branch_id").eq("completed", false),
      ]);
      if (!mounted) return;

      const map: Record<string, BranchStats> = {};
      const ensure = (id: string | null | undefined): BranchStats | null => {
        if (!id) return null;
        if (!map[id]) {
          map[id] = {
            dough: 0,
            tasksTotal: 0,
            tasksDone: 0,
            openTickets: 0,
            criticalTickets: 0,
            shortages: 0,
          };
        }
        return map[id];
      };

      // seed all branches
      branches.forEach((b) => ensure(b.id));

      // dough via RPC uses branch_name — map by name
      const doughRows =
        (doughRes.data as { branch_name: string; total_trays: number }[] | null) ?? [];
      doughRows.forEach((r) => {
        const b = branches.find((x) => x.name === r.branch_name);
        const s = ensure(b?.id);
        if (s) s.dough = Number(r.total_trays ?? 0);
      });

      const tasks = (tasksRes.data as { id: string; branch_id: string | null }[] | null) ?? [];
      tasks.forEach((t) => {
        const s = ensure(t.branch_id);
        if (s) s.tasksTotal += 1;
      });

      const logs =
        (logsRes.data as { task_id: string; branch_id: string | null }[] | null) ?? [];
      logs.forEach((l) => {
        const s = ensure(l.branch_id);
        if (s) s.tasksDone += 1;
      });

      const tickets =
        (ticketsRes.data as { branch_id: string | null; urgency: string | null }[] | null) ?? [];
      tickets.forEach((t) => {
        const s = ensure(t.branch_id);
        if (!s) return;
        s.openTickets += 1;
        if (t.urgency === "קריטי - משבית עבודה") s.criticalTickets += 1;
      });

      const shortages =
        (shortagesRes.data as { branch_id: string | null }[] | null) ?? [];
      shortages.forEach((r) => {
        const s = ensure(r.branch_id);
        if (s) s.shortages += 1;
      });

      setStats(map);
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, [branches]);

  const alerts = useMemo(() => {
    const list: { branchId: string; branchName: string; kind: "critical" | "shortage" | "tasks"; text: string }[] = [];
    const afterNoon = new Date().getHours() > 14;
    branches.forEach((b) => {
      const s = stats[b.id];
      if (!s) return;
      if (s.criticalTickets > 0) {
        list.push({ branchId: b.id, branchName: b.name, kind: "critical", text: "קריאת שירות קריטית פתוחה" });
      }
      if (s.shortages > 2) {
        list.push({ branchId: b.id, branchName: b.name, kind: "shortage", text: `${s.shortages} חוסרים פתוחים` });
      }
      if (afterNoon && s.tasksTotal > 0) {
        const pct = Math.round((s.tasksDone / s.tasksTotal) * 100);
        if (pct < 20) {
          list.push({
            branchId: b.id,
            branchName: b.name,
            kind: "tasks",
            text: `השלמת משימות נמוכה, ${pct} אחוז`,
          });
        }
      }
    });
    return list;
  }, [branches, stats]);

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <div className="rounded-xl bg-card/40 animate-pulse h-24" />
        <div className="rounded-xl bg-card/40 animate-pulse h-24" />
      </div>
    );
  }

  const multi = branches.length >= 2;

  return (
    <div className="flex flex-col gap-4">
      {/* Section 1: branch comparison */}
      <div className="flex flex-col gap-3">

        {branches.map((b) => {
          const s = stats[b.id] ?? {
            dough: 0,
            tasksTotal: 0,
            tasksDone: 0,
            openTickets: 0,
            criticalTickets: 0,
            shortages: 0,
          };
          const pct = s.tasksTotal > 0 ? (s.tasksDone / s.tasksTotal) * 100 : 100;
          const tasksColor =
            s.tasksTotal > 0 && s.tasksDone >= s.tasksTotal
              ? "text-neon"
              : pct < 50
                ? "text-amber-500"
                : "text-muted-foreground";
          const accent =
            s.criticalTickets > 0
              ? "border-l-2 border-l-red-500"
              : s.shortages > 0
                ? "border-l-2 border-l-amber-500"
                : "border-l-2 border-l-neon";
          return (
            <div
              key={b.id}
              className={`rounded-xl border border-border bg-card/60 p-4 w-full flex flex-col gap-2 ${accent}`}
            >
              <div className="font-bold text-sm">{b.name}</div>
              <div className="flex flex-col gap-1.5">
                <div
                  className="items-center gap-2 text-xs"
                  style={{ display: "grid", gridTemplateColumns: "1.25rem minmax(2rem, auto) 1fr" }}
                >
                  <Wheat className="h-3.5 w-3.5 shrink-0 text-neon" />
                  <span className="font-bold tabular-nums text-right min-w-[2rem]">{s.dough}</span>
                  <span className="text-muted-foreground">מיכלי בצק</span>
                </div>
                <div
                  className={`items-center gap-2 text-xs ${tasksColor}`}
                  style={{ display: "grid", gridTemplateColumns: "1.25rem minmax(2rem, auto) 1fr" }}
                >
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                  <span className="font-bold tabular-nums text-right min-w-[2rem]">
                    {s.tasksDone} / {s.tasksTotal}
                  </span>
                  <span className="text-muted-foreground">משימות</span>
                </div>
                <div
                  className={`items-center gap-2 text-xs ${s.openTickets > 0 ? "text-red-500" : "text-muted-foreground"}`}
                  style={{ display: "grid", gridTemplateColumns: "1.25rem minmax(2rem, auto) 1fr" }}
                >
                  <Wrench className="h-3.5 w-3.5 shrink-0" />
                  <span className="font-bold tabular-nums text-right min-w-[2rem]">{s.openTickets}</span>
                  <span className="text-muted-foreground">
                    {s.openTickets > 0 ? "קריאות פתוחות" : "אין קריאות ✓"}
                  </span>
                </div>
                <div
                  className={`items-center gap-2 text-xs ${s.shortages > 0 ? "text-amber-500" : "text-muted-foreground"}`}
                  style={{ display: "grid", gridTemplateColumns: "1.25rem minmax(2rem, auto) 1fr" }}
                >
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  <span className="font-bold tabular-nums text-right min-w-[2rem]">{s.shortages}</span>
                  <span className="text-muted-foreground">חוסרים</span>
                </div>
              </div>

            </div>
          );
        })}
      </div>

      {/* Section 2: alerts */}
      {alerts.length > 0 ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 flex flex-col gap-2">
          <div className="flex items-center gap-2 text-xs font-bold text-amber-500">
            <AlertTriangle className="h-4 w-4" />
            <span>דורש תשומת לב</span>
          </div>
          <div className="flex flex-col gap-1.5">
            {alerts.map((a, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <span
                  className={`h-2 w-2 rounded-full shrink-0 ${
                    a.kind === "critical"
                      ? "bg-red-500"
                      : a.kind === "shortage"
                        ? "bg-amber-500"
                        : "bg-orange-500"
                  }`}
                />
                <span className="font-semibold">{a.branchName}</span>
                <span className="text-muted-foreground">— {a.text}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card/40 p-4 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <CheckCircle2 className="h-4 w-4 text-neon" />
          <span>כל הסניפים תקינים</span>
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
