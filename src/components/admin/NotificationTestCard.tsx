// Admin tool: shows browser permission status and lets a super-admin fire a
// local Web Push + DB insert to verify the realtime/in-app pipeline.

import { useEffect, useState } from "react";
import { Bell, BellRing, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import {
  notificationPermission,
  notificationsSupported,
  requestNotificationPermission,
} from "@/lib/notifications";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { subscribeToPush } from "@/lib/push";

type Perm = NotificationPermission | "unsupported";

function permLabel(p: Perm): { text: string; cls: string } {
  if (p === "granted") return { text: "מאושר (Granted)", cls: "bg-green-500/15 text-green-400 border-green-500/40" };
  if (p === "denied") return { text: "חסום (Denied)", cls: "bg-red-500/15 text-red-400 border-red-500/40" };
  if (p === "default") return { text: "ממתין לאישור (Default)", cls: "bg-yellow-500/15 text-yellow-400 border-yellow-500/40" };
  return { text: "לא נתמך בדפדפן", cls: "bg-muted text-muted-foreground border-border" };
}

export function NotificationTestCard() {
  const { session } = useAuth();
  const [perm, setPerm] = useState<Perm>(() => notificationPermission());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setPerm(notificationPermission()), 2000);
    return () => clearInterval(t);
  }, []);

  const label = permLabel(perm);

  const handleEnable = async () => {
    setBusy(true);
    try {
      const res = await requestNotificationPermission();
      setPerm(res);
      if (res === "granted" && session?.user?.id) {
        try {
          await subscribeToPush(session.user.id);
          toast.success("הרשמת ל-Push הצליחה");
        } catch (e) {
          toast.error("הרשמת Push נכשלה — ייתכן והאתר רץ בתצוגה מקדימה");
        }
      }
    } finally {
      setBusy(false);
    }
  };

  const handleTest = async () => {
    if (!session?.user?.id) {
      toast.error("יש להתחבר כדי לבדוק");
      return;
    }
    setBusy(true);
    try {
      // Native notification (local OS-level).
      if (notificationsSupported() && Notification.permission === "granted") {
        try {
          new Notification("בדיקת מערכת", { body: "התראות הפוש עובדות בהצלחה!" });
        } catch (e) {
        }
      }
      // DB insert → realtime + in-app toast.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from("notifications" as never) as any).insert({
        user_id: session.user.id,
        type: "test",
        title: "בדיקת מערכת",
        body: "התראות הפוש עובדות בהצלחה!",
        data: { test: true },
      });
      if (error) throw error;
      toast.success("נשלחה התראת ניסיון");
    } catch (e) {
      toast.error("בדיקת התראה נכשלה");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div dir="rtl" className="rounded-xl border border-border bg-card/60 p-5">
      <div className="flex items-center gap-2 mb-3">
        <div className="p-2 rounded-md bg-neon/10 text-neon">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div>
          <h3 className="font-bold text-foreground">הגדרות ובדיקת התראות</h3>
          <p className="text-[11px] text-muted-foreground">
            ודא שהתראות Push ו-Realtime פועלות במכשיר זה.
          </p>
        </div>
      </div>

      <div className="mb-3">
        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider mr-2">
          סטטוס הרשאה:
        </span>
        <span className={`inline-block text-xs font-bold px-2 py-1 rounded-md border ${label.cls}`}>
          {label.text}
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        {perm !== "granted" && perm !== "unsupported" && (
          <button
            type="button"
            disabled={busy}
            onClick={handleEnable}
            className="inline-flex items-center gap-2 rounded-lg border border-neon/60 text-neon font-bold px-4 py-2 text-sm hover:bg-neon/10 transition disabled:opacity-50"
          >
            <Bell className="h-4 w-4" />
            אפשר התראות בדפדפן
          </button>
        )}
        <button
          type="button"
          disabled={busy}
          onClick={handleTest}
          className="inline-flex items-center gap-2 rounded-lg bg-neon text-primary-foreground font-bold px-4 py-2 text-sm glow-neon hover:brightness-110 transition disabled:opacity-50"
        >
          <BellRing className="h-4 w-4" />
          שלח התראת ניסיון
        </button>
      </div>
    </div>
  );
}
