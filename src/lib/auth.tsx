import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "viewer";
export type SimulatedRole = "super_admin" | "manager" | "employee";

interface AuthState {
  session: Session | null;
  email: string | null;
  fullName: string | null;
  /** Effective role (respects "View As" simulation when super admin). */
  role: AppRole | null;
  /** Effective super-admin flag (respects simulation). */
  isSuperAdmin: boolean;
  /** Real DB role, never overridden by simulation. */
  realRole: AppRole | null;
  /** Real DB super-admin flag, never overridden by simulation. */
  realIsSuperAdmin: boolean;
  /** Currently simulated role (active only when real user is super admin). */
  simulatedRole: SimulatedRole | null;
  setSimulatedRole: (r: SimulatedRole | null) => void;
  assignedBranchId: string | null;
  tutorialVersion: number;
  completedTutorialSteps: string[];
  tutorialCooldownUntil: string | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshRole: () => Promise<void>;
  setTutorialVersion: (v: number) => Promise<void>;
  markTutorialStepComplete: (stepId: string) => Promise<void>;
  markTutorialStepsComplete: (stepIds: string[]) => Promise<void>;
  snoozeTutorial: (days?: number) => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [fullName, setFullName] = useState<string | null>(null);
  const [assignedBranchId, setAssignedBranchId] = useState<string | null>(null);
  const [tutorialVersion, setTutorialVersionState] = useState<number>(2);
  const [completedTutorialSteps, setCompletedTutorialSteps] = useState<string[]>([]);
  const [tutorialCooldownUntil, setTutorialCooldownUntil] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [simulatedRole, setSimulatedRoleState] = useState<SimulatedRole | null>(null);

  // Hydrate simulated role from sessionStorage (only honored if real user is super admin).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const v = sessionStorage.getItem("pizzax-sim-role");
    if (v === "super_admin" || v === "manager" || v === "employee") {
      setSimulatedRoleState(v);
    }
  }, []);

  const setSimulatedRole = (r: SimulatedRole | null) => {
    setSimulatedRoleState(r);
    if (typeof window !== "undefined") {
      if (r) sessionStorage.setItem("pizzax-sim-role", r);
      else sessionStorage.removeItem("pizzax-sim-role");
    }
  };

  const loadRole = async (uid: string | undefined) => {
    if (!uid) {
      setRole(null);
      setIsSuperAdmin(false);
      setFullName(null);
      setAssignedBranchId(null);
      setTutorialVersionState(2);
      setCompletedTutorialSteps([]);
      setTutorialCooldownUntil(null);
      return;
    }
    const [{ data: roleRows }, { data: profile }] = await Promise.all([
      supabase
        .from("user_roles")
        .select("role, assigned_branch_id")
        .eq("user_id", uid)
        .eq("is_active", true),
      supabase
        .from("profiles")
        .select("full_name, tutorial_version, completed_tutorial_steps, tutorial_cooldown_until")
        .eq("user_id", uid)
        .maybeSingle(),
    ]);
    const roles =
      (roleRows as { role: string; assigned_branch_id: string | null }[] | null) ?? [];
    const hasAdmin = roles.some((row) => row.role === "admin");
    const hasViewer = roles.some((row) => row.role === "viewer");
    const hasSuper = roles.some((row) => row.role === "super_admin");
    const hasShiftManager = roles.some((row) => row.role === "shift_manager");
    // super_admin and shift_manager implicitly have full admin access
    setRole(hasAdmin || hasSuper || hasShiftManager ? "admin" : hasViewer ? "viewer" : null);
    setIsSuperAdmin(hasSuper);
    setAssignedBranchId(
      roles.find((row) => row.role !== "super_admin" && row.assigned_branch_id)?.assigned_branch_id ??
        roles.find((row) => row.assigned_branch_id)?.assigned_branch_id ??
        null,
    );
    setFullName((profile?.full_name as string | null) ?? null);
    const p = profile as { tutorial_version?: number; completed_tutorial_steps?: string[]; tutorial_cooldown_until?: string | null } | null;
    setTutorialVersionState(typeof p?.tutorial_version === "number" ? p.tutorial_version : 0);
    setCompletedTutorialSteps(Array.isArray(p?.completed_tutorial_steps) ? p!.completed_tutorial_steps : []);
    setTutorialCooldownUntil(p?.tutorial_cooldown_until ?? null);
  };

  const snoozeTutorial = async (days = 7) => {
    const until = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
    setTutorialCooldownUntil(until);
    const uid = session?.user?.id;
    if (!uid) return;
    await supabase.from("profiles").update({ tutorial_cooldown_until: until }).eq("user_id", uid);
  };

  const setTutorialVersion = async (v: number) => {
    setTutorialVersionState(v);
    const uid = session?.user?.id;
    if (!uid) return;
    await supabase.from("profiles").update({ tutorial_version: v }).eq("user_id", uid);
  };

  const markTutorialStepsComplete = async (stepIds: string[]) => {
    if (!stepIds || stepIds.length === 0) return;
    let nextArr: string[] = [];
    setCompletedTutorialSteps((prev) => {
      const merged = Array.from(new Set([...prev, ...stepIds]));
      nextArr = merged;
      return merged;
    });
    const uid = session?.user?.id;
    if (!uid) return;
    await supabase.from("profiles").update({ completed_tutorial_steps: nextArr }).eq("user_id", uid);
  };

  const markTutorialStepComplete = async (stepId: string) => {
    await markTutorialStepsComplete([stepId]);
  };


  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      loadRole(s?.user?.id);
    });

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      loadRole(data.session?.user?.id).finally(() => setLoading(false));
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setRole(null);
    setIsSuperAdmin(false);
    setFullName(null);
    setAssignedBranchId(null);
  };

  const refreshRole = async () => {
    await loadRole(session?.user?.id);
  };

  // Apply simulation only when the real user is super admin.
  const sim = isSuperAdmin ? simulatedRole : null;
  const effectiveRole: AppRole | null = sim
    ? sim === "employee"
      ? "viewer"
      : "admin"
    : role;
  const effectiveIsSuperAdmin = sim ? sim === "super_admin" : isSuperAdmin;

  return (
    <AuthContext.Provider
      value={{
        session,
        email: session?.user?.email ?? null,
        fullName,
        role: effectiveRole,
        isSuperAdmin: effectiveIsSuperAdmin,
        realRole: role,
        realIsSuperAdmin: isSuperAdmin,
        simulatedRole: sim,
        setSimulatedRole,
        assignedBranchId,
        tutorialVersion,
        completedTutorialSteps,
        tutorialCooldownUntil,
        loading,
        signOut,
        refreshRole,
        setTutorialVersion,
        markTutorialStepComplete,
        markTutorialStepsComplete,
        snoozeTutorial,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}


export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
