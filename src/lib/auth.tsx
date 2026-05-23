import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "viewer";

interface AuthState {
  session: Session | null;
  email: string | null;
  role: AppRole | null;
  isSuperAdmin: boolean;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshRole: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadRole = async (uid: string | undefined) => {
    if (!uid) {
      setRole(null);
      setIsSuperAdmin(false);
      return;
    }
    const [{ data: roleData }, { data: superData }] = await Promise.all([
      supabase.rpc("current_user_role"),
      supabase.rpc("is_super_admin", { _user_id: uid }),
    ]);
    setRole((roleData as AppRole | null) ?? null);
    setIsSuperAdmin(Boolean(superData));
  };

  useEffect(() => {
    // Set up listener FIRST
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      // Defer role fetch
      setTimeout(() => {
        loadRole(s?.user?.id);
      }, 0);
    });

    // THEN get existing session
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
  };

  const refreshRole = async () => {
    await loadRole(session?.user?.id);
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        email: session?.user?.email ?? null,
        role,
        isSuperAdmin,
        loading,
        signOut,
        refreshRole,
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
