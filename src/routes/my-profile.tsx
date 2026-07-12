import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BookOpen, ShieldCheck, User, Building2, BadgeCheck, Calendar, Cake, Briefcase, LogOut, Bell, Download } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { subscribeToPush, PushSubscribeError, isIOS, isStandalone } from "@/lib/push";
import { toast } from "sonner";

export const Route = createFileRoute("/my-profile")({
  head: () => ({
    meta: [
      { title: "האזור האישי שלי — Pizza X" },
      { name: "description", content: "אזור אישי לעובד Pizza X — סיכום, מדריך וגישה ל-NDA." },
    
      { property: "og:title", content: "האזור האישי שלי — Pizza X" },
      { property: "og:description", content: "אזור אישי לעובד Pizza X — סיכום, מדריך וגישה ל-NDA." },
      { property: "og:url", content: "https://pizzaxboh.lovable.app/my-profile" },
      { property: "og:type", content: "website" },
    ], links: [{ rel: "canonical", href: "https://pizzaxboh.lovable.app/my-profile" }],
  }),
  component: MyProfilePage,
});

const NDA_TEXT = `המידע הזמין במערכת זו הוא קניינו הבלעדי של Pizza X. כל שיתוף, העתקה, צילום או הפצה של מתכונים, נהלים או מידע פנימי לגורם חיצוני אסורים בהחלט. המשך השימוש מהווה הסכמה מלאה לתנאי הסודיות.`;

const ROLE_LABEL: Record<string, string> = {
  super_admin: "מנהל-על",
  admin: "מנהל",
  viewer: "עובד",
};

function MyProfilePage() {
  const { session, fullName, email, role, isSuperAdmin, signOut } = useAuth();
  const [ndaOpen, setNdaOpen] = useState(false);
  const [branchName, setBranchName] = useState<string | null>(null);
  const [joinDate, setJoinDate] = useState<string | null>(null);
  const [dob, setDob] = useState<string | null>(null);
  const [startDate, setStartDate] = useState<string | null>(null);
  const [pushEnabled, setPushEnabled] = useState(false);

  const displayName = fullName || email?.split("@")[0] || "אורח";
  const userId = session?.user?.id;

  useEffect(() => {
    if (!userId) return;
    (async () => {
      const [{ data: roleRow }, { data: profileRow }] = await Promise.all([
        supabase
          .from("user_roles")
          .select("assigned_branch_id, created_at")
          .eq("user_id", userId)
          .maybeSingle(),
        supabase
          .from("profiles")
          .select("created_at,date_of_birth,start_date")
          .eq("user_id", userId)
          .maybeSingle(),
      ]);
      if (roleRow?.assigned_branch_id) {
        const { data: b } = await supabase
          .from("branches")
          .select("name")
          .eq("id", roleRow.assigned_branch_id)
          .maybeSingle();
        setBranchName(b?.name ?? null);
      }
      const created = (profileRow?.created_at as string) || (roleRow?.created_at as string) || null;
      if (created) setJoinDate(new Date(created).toLocaleDateString("he-IL"));
      const fmt = (d?: string | null) =>
        d ? new Date(d + "T00:00:00").toLocaleDateString("he-IL", { day: "2-digit", month: "long", year: "numeric" }) : null;
      setDob(fmt(profileRow?.date_of_birth as string | null));
      setStartDate(fmt(profileRow?.start_date as string | null));
    })();
    // Check push subscription status
    if ("serviceWorker" in navigator && "PushManager" in window) {
      navigator.serviceWorker.getRegistration().then((reg) =>
        reg?.pushManager.getSubscription().then((sub) => setPushEnabled(Boolean(sub))),
      );
    }
  }, [userId]);

  const iosBlocked = isIOS() && !isStandalone();

  const enablePush = async () => {
    if (!userId) return;
    try {
      await subscribeToPush(userId);
      setPushEnabled(true);
      toast.success("התראות הופעלו בהצלחה");
    } catch (e) {
      console.error("[my-profile] enablePush failed", e);
      if (e instanceof PushSubscribeError) {
        switch (e.reason) {
          case "permission-denied":
            toast.error("הדפדפן חוסם התראות", {
              description: "אנא לחץ על המנעול בשורת הכתובת ואשר קבלת התראות.",
            });
            return;
          case "ios-not-standalone":
            toast.error("דרושה התקנה למסך הבית", {
              description: "כדי לקבל התראות באייפון, יש להתקין את האפליקציה למסך הבית קודם.",
            });
            return;
          case "preview":
            toast.error("התראות לא פעילות בתצוגה המקדימה", {
              description: "פתח/י את האתר המפורסם כדי להירשם.",
            });
            return;
          case "unsupported":
            toast.error("הדפדפן לא תומך בהתראות Push");
            return;
          case "permission-dismissed":
            toast.error("ההרשאה לא אושרה", { description: "נסה/י שוב ואשר/י את הבקשה." });
            return;
          default:
            toast.error("לא ניתן להפעיל התראות", { description: e.message });
            return;
        }
      }
      toast.error("שגיאה לא צפויה בהפעלת התראות");
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      {/* Hero greeting */}
      <div className="relative overflow-hidden rounded-2xl border-2 border-neon bg-gradient-to-br from-card via-card to-neon/10 p-6 glow-neon">
        <div className="flex items-center gap-3 mb-2">
          <div className="h-14 w-14 rounded-full bg-neon/20 border-2 border-neon flex items-center justify-center">
            <User className="h-7 w-7 text-neon" />
          </div>
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-black text-foreground leading-tight">
              אהלן {displayName}! 👋
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">{email}</p>
          </div>
        </div>
      </div>

      {/* Summary card */}
      <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
        <h2 className="font-bold text-sm text-muted-foreground uppercase tracking-wider mb-2">
          סיכום
        </h2>
        <Row icon={<BadgeCheck className="h-4 w-4" />} label="תפקיד" value={isSuperAdmin ? "מנהל-על" : ROLE_LABEL[role ?? "viewer"]} />
        <Row icon={<Building2 className="h-4 w-4" />} label="סניף משויך" value={branchName ?? "—"} />
        <Row icon={<Briefcase className="h-4 w-4" />} label="תאריך כניסה לפיצה" value={startDate ?? "—"} />
        <Row icon={<Cake className="h-4 w-4" />} label="יום הולדת" value={dob ?? "—"} />
        <Row icon={<Calendar className="h-4 w-4" />} label="נרשם/ה למערכת" value={joinDate ?? "—"} />
        <Row icon={<ShieldCheck className="h-4 w-4" />} label="הסכם סודיות" value="חתום ✓" />
      </div>

      {/* Quick actions */}
      <div className="space-y-2.5">
        <Link
          to="/guide"
          className="flex items-center gap-3 p-4 rounded-xl border border-border bg-card hover:border-neon hover:bg-neon/5 active:scale-[0.99] transition touch-manipulation"
        >
          <BookOpen className="h-5 w-5 text-neon shrink-0" />
          <div className="flex-1">
            <div className="font-bold text-sm">מדריך לעובד</div>
            <div className="text-xs text-muted-foreground">כל הפיצ'רים והנהלים</div>
          </div>
        </Link>

        <button
          type="button"
          onClick={() => setNdaOpen(true)}
          className="w-full flex items-center gap-3 p-4 rounded-xl border border-border bg-card hover:border-neon hover:bg-neon/5 active:scale-[0.99] transition touch-manipulation text-right"
        >
          <ShieldCheck className="h-5 w-5 text-neon shrink-0" />
          <div className="flex-1">
            <div className="font-bold text-sm">הסכם הסודיות שלי (NDA)</div>
            <div className="text-xs text-muted-foreground">צפייה במסמך החתום</div>
          </div>
        </button>

        {!pushEnabled && (
          <button
            type="button"
            onClick={enablePush}
            disabled={iosBlocked}
            className="w-full flex items-center gap-3 p-4 rounded-xl border-2 border-dashed border-neon/60 bg-neon/5 hover:bg-neon/10 active:scale-[0.99] transition touch-manipulation text-right disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100"
          >
            <Bell className="h-5 w-5 text-neon shrink-0" />
            <div className="flex-1">
              <div className="font-bold text-sm">הפעלת התראות Push</div>
              <div className="text-xs text-muted-foreground">
                {iosBlocked
                  ? "כדי לקבל התראות באייפון, יש להתקין את האפליקציה למסך הבית קודם."
                  : "קבל/י התראות במכשיר גם כשהאפליקציה סגורה"}
              </div>
            </div>
          </button>
        )}

        <button
          type="button"
          onClick={() => void signOut()}
          className="w-full flex items-center gap-3 p-4 rounded-xl border border-destructive/40 bg-destructive/5 text-destructive hover:bg-destructive/10 active:scale-[0.99] transition touch-manipulation text-right"
        >
          <LogOut className="h-5 w-5 shrink-0" />
          <div className="flex-1 font-bold text-sm">התנתקות</div>
        </button>
      </div>

      {/* NDA modal */}
      {ndaOpen && (
        <div
          className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-sm flex items-center justify-center px-4"
          onClick={() => setNdaOpen(false)}
        >
          <div
            className="max-w-lg w-full rounded-2xl border-2 border-neon bg-card p-6 glow-neon"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-display text-xl font-bold mb-3 flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-neon" />
              הסכם סודיות — חתום
            </h2>
            <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap mb-4">
              {NDA_TEXT}
            </p>
            <div className="text-xs text-muted-foreground border-t border-border pt-3 mb-4">
              נחתם על-ידי: <span className="font-bold text-foreground">{displayName}</span>
              {joinDate && <> · {joinDate}</>}
            </div>
            <button
              onClick={() => setNdaOpen(false)}
              className="w-full rounded-md bg-neon px-4 py-2.5 text-sm font-bold text-primary-foreground hover:opacity-90"
            >
              סגור
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <div className="flex items-center gap-2 text-muted-foreground text-sm">
        {icon}
        {label}
      </div>
      <div className="font-bold text-sm text-foreground text-left">{value}</div>
    </div>
  );
}
