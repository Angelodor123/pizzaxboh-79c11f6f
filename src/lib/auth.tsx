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
  loading: boolean;
  signOut: () => Promise<void>;
  refreshRole: () => Promise<void>;
  setTutorialVersion: (v: number) => Promise<void>;
  markTutorialStepComplete: (stepId: string) => Promise<void>;
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
  const [loading, setLoading] = useState(true);

  const loadRole = async (uid: string | undefined) => {
    if (!uid) {
      setRole(null);
      setIsSuperAdmin(false);
      setFullName(null);
      setAssignedBranchId(null);
      setTutorialVersionState(2);
      setCompletedTutorialSteps([]);
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
          .select("full_name, tutorial_version, completed_tutorial_steps")
          .eq("user_id", uid)
          .maybeSingle(),
      ]);
    setRole((roleData as AppRole | null) ?? null);
    setIsSuperAdmin(Boolean(superData));
    setAssignedBranchId((roleRow?.assigned_branch_id as string | null) ?? null);
    setFullName((profile?.full_name as string | null) ?? null);
    const p = profile as { tutorial_version?: number; completed_tutorial_steps?: string[] } | null;
    setTutorialVersionState(typeof p?.tutorial_version === "number" ? p.tutorial_version : 0);
    setCompletedTutorialSteps(Array.isArray(p?.completed_tutorial_steps) ? p!.completed_tutorial_steps : []);
  };

  const setTutorialVersion = async (v: number) => {
    setTutorialVersionState(v);
    const uid = session?.user?.id;
    if (!uid) return;
    await supabase.from("profiles").update({ tutorial_version: v }).eq("user_id", uid);
  };

  const markTutorialStepComplete = async (stepId: string) => {
    let nextArr: string[] = [];
    setCompletedTutorialSteps((prev) => {
      if (prev.includes(stepId)) {
        nextArr = prev;
        return prev;
      }
      nextArr = [...prev, stepId];
      return nextArr;
    });
    const uid = session?.user?.id;
    if (!uid) return;
    // Persist as the new full array (idempotent, avoids array_append race conditions)
    await supabase.from("profiles").update({ completed_tutorial_steps: nextArr }).eq("user_id", uid);
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
        loading,
        signOut,
        refreshRole,
        setTutorialVersion,
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
