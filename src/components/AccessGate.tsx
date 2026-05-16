import { useState } from "react";
import { LogIn, Lock } from "lucide-react";
import { lovable } from "@/integrations/lovable/index";
import pizzaXLogo from "@/assets/pizza-x-logo.png";
import { useAuth } from "@/lib/auth";

export function AccessGate({ children }: { children: React.ReactNode }) {
  const { loading, session, role, email, signOut } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-muted-foreground text-sm">טוען…</div>
      </div>
    );
  }

  // Authenticated AND has a role → allow app
  if (session && role) {
    return <>{children}</>;
  }

  return (
    <LoginScreen
      authenticatedButUnauthorized={!!session && !role}
      email={email}
      onSignOut={signOut}
    />
  );
}

function LoginScreen({
  authenticatedButUnauthorized,
  email,
  onSignOut,
}: {
  authenticatedButUnauthorized: boolean;
  email: string | null;
  onSignOut: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogle = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        setError("ההתחברות נכשלה. נסה שוב.");
        setBusy(false);
        return;
      }
      if (result.redirected) return;
      window.location.reload();
    } catch {
      setError("שגיאת חיבור. נסה שוב.");
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md text-center">
        <img
          src={pizzaXLogo}
          alt="Pizza X"
          className="h-16 w-auto mx-auto object-contain"
          style={{ filter: "drop-shadow(0 0 12px rgba(255,20,147,0.4))" }}
        />
        <div className="mt-2 text-[10px] font-bold tracking-[0.3em] uppercase text-neon">
          Back of House
        </div>

        <div className="mt-8 rounded-xl border border-border bg-card p-6">
          <div className="mx-auto h-12 w-12 rounded-full bg-neon/10 flex items-center justify-center text-neon">
            <Lock className="h-5 w-5" />
          </div>

          {authenticatedButUnauthorized ? (
            <>
              <h1 className="mt-4 font-display text-xl font-bold text-foreground">
                הגישה למערכת מוגבלת
              </h1>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                הגישה למערכת מוגבלת למוזמנים בלבד.
                <br />
                החשבון <span className="text-foreground font-bold">{email}</span> לא הוזמן עדיין.
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                פנה למנהל המערכת כדי לקבל הרשאה.
              </p>
              <button
                onClick={onSignOut}
                className="mt-5 w-full inline-flex items-center justify-center gap-2 rounded-md border border-border text-foreground py-2.5 font-bold hover:bg-background transition"
              >
                התנתק
              </button>
            </>
          ) : (
            <>
              <h1 className="mt-4 font-display text-xl font-bold text-foreground">
                כניסה למערכת
              </h1>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                הגישה למערכת מוגבלת למוזמנים בלבד.
                <br />
                התחבר עם חשבון Google שהוזמן על ידי מנהל.
              </p>
              {error && (
                <p className="mt-3 text-xs text-destructive">{error}</p>
              )}
              <button
                onClick={handleGoogle}
                disabled={busy}
                className="mt-5 w-full inline-flex items-center justify-center gap-2 rounded-md bg-neon text-primary-foreground py-3 font-bold glow-neon disabled:opacity-50 transition"
              >
                <LogIn className="h-4 w-4" />
                {busy ? "מתחבר…" : "התחבר עם Google"}
              </button>
            </>
          )}
        </div>

        <p className="mt-6 text-[10px] text-muted-foreground tracking-widest uppercase">
          Pizza X • Invite-Only Kitchen OS
        </p>
      </div>
    </div>
  );
}
