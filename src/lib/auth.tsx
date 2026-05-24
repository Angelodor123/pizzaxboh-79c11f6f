import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "viewer";

interface AuthState {
  session: Session | null;
  email: string | null;
  fullName: string | null;
  role: AppRole | null;
  isSuperAdmin: boolean;
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
    const [{ data: roleData }, { data: superData }, { data: roleRow }, { data: profile }] =
      await Promise.all([
        supabase.rpc("current_user_role"),
        supabase.rpc("is_super_admin", { _user_id: uid }),
        supabase
          .from("user_roles")
          .select("assigned_branch_id")
          .eq("user_id", uid)
          .maybeSingle(),
        supabase
          .from("profiles")
          .select("full_name, tutorial_version, completed_tutorial_steps, tutorial_cooldown_until")
          .eq("user_id", uid)
          .maybeSingle(),
      ]);
    setRole((roleData as AppRole | null) ?? null);
    setIsSuperAdmin(Boolean(superData));
    setAssignedBranchId((roleRow?.assigned_branch_id as string | null) ?? null);
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
      setTimeout(() => {
        loadRole(s?.user?.id);
      }, 0);
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

  return (
    <AuthContext.Provider
      value={{
        session,
        email: session?.user?.email ?? null,
        fullName,
        role,
        isSuperAdmin,
        assignedBranchId,
        tutorialVersion,
        completedTutorialSteps,
        loading,
        signOut,
        refreshRole,
        setTutorialVersion,
        markTutorialStepComplete,
        markTutorialStepsComplete,
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
