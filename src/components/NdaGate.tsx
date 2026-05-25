import { useEffect, useState } from "react";
import { ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { InstallAppPrompt } from "@/components/InstallAppPrompt";

const NDA_TEXT = `המידע הזמין במערכת זו הוא קניינו הבלעדי של Pizza X. כל שיתוף, העתקה, צילום או הפצה של מתכונים, נהלים או מידע פנימי לגורם חיצוני אסורים בהחלט. המשך השימוש מהווה הסכמה מלאה לתנאי הסודיות.`;

export function NdaGate({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  const [accepted, setAccepted] = useState<boolean | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!session?.user?.id) {
      setAccepted(null);
      return;
    }
    let mounted = true;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("has_accepted_nda")
        .eq("user_id", session.user.id)
        .maybeSingle();
      if (!mounted) return;
      setAccepted(Boolean(data?.has_accepted_nda));
    })();
    return () => {
      mounted = false;
    };
  }, [session?.user?.id]);

  const accept = async () => {
    if (!session?.user?.id) return;
    setSubmitting(true);
    await supabase
      .from("profiles")
      .upsert({ user_id: session.user.id, has_accepted_nda: true }, { onConflict: "user_id" });
    setAccepted(true);
    setSubmitting(false);
  };

  // Block content until NDA is decided AND accepted — onboarding banners and
  // page content must NEVER appear behind the NDA modal.
  if (session?.user?.id && accepted !== true) {
    return (
      <div className="fixed inset-0 z-[100] bg-background flex items-center justify-center px-4">
        {accepted === false && (
          <div className="max-w-lg w-full rounded-2xl border-2 border-neon bg-card p-6 glow-neon">
            <div className="flex items-center gap-2 mb-3">
              <ShieldAlert className="h-6 w-6 text-neon" />
              <h2 className="font-display text-xl font-bold">הסכם סודיות — Pizza X</h2>
            </div>
            <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap">
              {NDA_TEXT}
            </p>
            <button
              type="button"
              onClick={() => void accept()}
              disabled={submitting}
              className="mt-5 w-full inline-flex items-center justify-center rounded-md bg-neon text-primary-foreground py-3 font-bold glow-neon disabled:opacity-50"
            >
              {submitting ? "מאשר…" : "מאשר/ת"}
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      {children}
      <InstallAppPrompt active={accepted === true} />
    </>
  );
}

