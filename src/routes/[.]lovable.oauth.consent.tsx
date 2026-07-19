import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AccessGate } from "@/components/AccessGate";

// The consent screen is only meaningful for signed-in users; AccessGate handles
// the sign-in flow if the user isn't logged in and preserves the URL through
// the (popup) OAuth reload.
type OAuthNs = {
  getAuthorizationDetails: (id: string) => Promise<{
    data: {
      client?: { name?: string; client_uri?: string; redirect_uris?: string[] };
      scope?: string;
      redirect_url?: string;
      redirect_to?: string;
    } | null;
    error: { message: string } | null;
  }>;
  approveAuthorization: (id: string) => Promise<{
    data: { redirect_url?: string; redirect_to?: string } | null;
    error: { message: string } | null;
  }>;
  denyAuthorization: (id: string) => Promise<{
    data: { redirect_url?: string; redirect_to?: string } | null;
    error: { message: string } | null;
  }>;
};

const oauth = () =>
  (supabase.auth as unknown as { oauth: OAuthNs }).oauth;

export const Route = createFileRoute("/.lovable/oauth/consent")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id: typeof s.authorization_id === "string" ? s.authorization_id : "",
  }),
  loader: async ({ location }) => {
    const authorizationId = new URLSearchParams(location.search).get("authorization_id");
    if (!authorizationId) throw new Error("Missing authorization_id");
    const { data, error } = await oauth().getAuthorizationDetails(authorizationId);
    if (error) throw new Error(error.message);
    const immediate = data?.redirect_url ?? data?.redirect_to;
    if (immediate && !data?.client) {
      window.location.href = immediate;
      return null;
    }
    return data;
  },
  component: () => (
    <AccessGate>
      <ConsentScreen />
    </AccessGate>
  ),
  errorComponent: ({ error }) => (
    <AccessGate>
      <main className="min-h-screen flex items-center justify-center bg-background p-6 text-center">
        <div className="max-w-md">
          <h1 className="text-xl font-bold mb-2">בקשת ההרשאה נכשלה</h1>
          <p className="text-sm text-muted-foreground">
            {String((error as Error)?.message ?? error)}
          </p>
        </div>
      </main>
    </AccessGate>
  ),
});

function ConsentScreen() {
  const details = Route.useLoaderData();
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const clientName = details?.client?.name ?? "אפליקציה חיצונית";
  const scopeStr = details?.scope ?? "";

  async function decide(approve: boolean) {
    setBusy(true);
    setErr(null);
    const { data, error } = approve
      ? await oauth().approveAuthorization(authorization_id)
      : await oauth().denyAuthorization(authorization_id);
    if (error) {
      setBusy(false);
      setErr(error.message);
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      setErr("שרת ההרשאה לא החזיר כתובת חזרה.");
      return;
    }
    window.location.href = target;
  }

  return (
    <main
      className="min-h-screen flex items-center justify-center bg-background p-4"
      dir="rtl"
    >
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-lg">
        <h1 className="text-xl font-bold text-center">
          חיבור {clientName} לחשבון שלך
        </h1>
        <p className="mt-3 text-sm text-muted-foreground text-center">
          {clientName} יוכל להשתמש בכלים של PizzaXBoh בשמך, תחת ההרשאות שלך במערכת.
        </p>
        {scopeStr && (
          <p className="mt-2 text-[11px] text-muted-foreground text-center opacity-70">
            הרשאות: {scopeStr}
          </p>
        )}
        <p className="mt-3 text-xs text-muted-foreground text-center">
          אין בכך עקיפה של הרשאות הסניף או ה-RLS של המערכת.
        </p>

        {err && (
          <p role="alert" className="mt-3 text-sm text-red-500 text-center">
            {err}
          </p>
        )}

        <div className="mt-6 flex flex-col gap-2">
          <button
            disabled={busy}
            onClick={() => decide(true)}
            className="w-full rounded-md bg-neon px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50"
          >
            אישור חיבור
          </button>
          <button
            disabled={busy}
            onClick={() => decide(false)}
            className="w-full rounded-md border border-border px-4 py-2 text-sm disabled:opacity-50"
          >
            ביטול
          </button>
        </div>
      </div>
    </main>
  );
}
