import { useEffect, useState } from "react";
import { Bell, X } from "lucide-react";
import { toast } from "sonner";
import {
  notificationsSupported,
  notificationPermission,
  requestNotificationPermission,
} from "@/lib/notifications";
import { subscribeToPush } from "@/lib/push";
import { useAuth } from "@/lib/auth";

const SNOOZE_KEY = "pizzax-notif-snooze-until";

export function NotificationPermissionBanner() {
  const { session } = useAuth();
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!notificationsSupported()) return;
    if (notificationPermission() !== "default") return;
    const until = Number(localStorage.getItem(SNOOZE_KEY) ?? 0);
    if (until && Date.now() < until) return;
    setShow(true);
  }, []);

  if (!show) return null;

  const handleEnable = async () => {
    setBusy(true);
    try {
      const res = await requestNotificationPermission();
      if (res === "granted") {
        toast.success("התראות הופעלו בהצלחה");
        if (session?.user?.id) {
          try {
            await subscribeToPush(session.user.id);
          } catch (e) {
          }
        }
        setShow(false);
      } else if (res === "denied") {
        toast.error("הדפדפן חוסם התראות. ניתן לאשר ידנית בהגדרות.");
        setShow(false);
      }
    } finally {
      setBusy(false);
    }
  };

  const handleSnooze = () => {
    localStorage.setItem(SNOOZE_KEY, String(Date.now() + 24 * 60 * 60 * 1000));
    setShow(false);
  };

  return (
    <div
      dir="rtl"
      className="mb-4 rounded-xl border-2 border-neon/60 bg-neon/5 p-4 flex items-start gap-3 shadow-[0_0_28px_-10px_hsl(var(--neon))]"
    >
      <div className="p-2 rounded-md bg-neon/15 text-neon shrink-0">
        <Bell className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-foreground leading-relaxed">
          🔔 הפעל התראות כדי לקבל עדכונים חשובים ומשימות אישיות בזמן אמת.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleEnable}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-lg bg-neon text-primary-foreground font-bold px-4 py-2 text-sm glow-neon hover:brightness-110 transition disabled:opacity-50"
          >
            <Bell className="h-4 w-4" />
            {busy ? "מפעיל…" : "הפעל התראות"}
          </button>
          <button
            type="button"
            onClick={handleSnooze}
            className="inline-flex items-center gap-2 rounded-lg border border-border text-foreground/80 font-bold px-4 py-2 text-sm hover:bg-muted/40 transition"
          >
            לא עכשיו
          </button>
        </div>
      </div>
      <button
        type="button"
        onClick={handleSnooze}
        aria-label="סגור"
        className="text-muted-foreground hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
