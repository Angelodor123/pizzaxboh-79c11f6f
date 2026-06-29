import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Bell, Settings2, Send, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { broadcastPush } from "@/lib/push.functions";

export const Route = createFileRoute("/admin/alerts")({
  head: () => ({
    meta: [
      { title: "ניהול התראות — Pizza X" },
      { name: "description", content: "פאנל ניהול התראות ומלאי בצק" },
    ], links: [{ rel: "canonical", href: "https://pizzaxboh.lovable.app/admin/alerts" }],
  }),
  component: AdminAlertsPage,
});

const SETTING_KEY = "dough_alert_threshold";
const DEFAULT_THRESHOLD = 15;

function AdminAlertsPage() {
  const { role, isSuperAdmin, loading } = useAuth();
  const broadcast = useServerFn(broadcastPush);

  const [threshold, setThreshold] = useState<number>(DEFAULT_THRESHOLD);
  const [thresholdSaving, setThresholdSaving] = useState(false);

  const [message, setMessage] = useState("");
  const [target, setTarget] = useState<"all" | "managers">("all");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", SETTING_KEY)
        .maybeSingle();
      const v = (data?.value as { value?: number } | null)?.value;
      if (typeof v === "number") setThreshold(v);
    })();
  }, []);

  if (loading) {
    return <div className="p-8 text-center text-muted-foreground">טוען…</div>;
  }
  const allowed = role === "admin" || isSuperAdmin;
  if (!allowed) {
    return (
      <div className="max-w-md mx-auto p-8 text-center">
        <h1 className="text-xl font-bold">אין הרשאה</h1>
        <p className="text-sm text-muted-foreground mt-2">העמוד זמין למנהלים בלבד.</p>
      </div>
    );
  }

  const saveThreshold = async () => {
    if (!Number.isFinite(threshold) || threshold < 1 || threshold > 999) {
      toast.error("סף לא תקין", { description: "בחר ערך בין 1 ל-999" });
      return;
    }
    setThresholdSaving(true);
    const { error } = await supabase.from("app_settings").upsert(
      { key: SETTING_KEY, value: { value: threshold } },
      { onConflict: "key" },
    );
    setThresholdSaving(false);
    if (error) {
      toast.error("שגיאה בשמירה", { description: error.message });
    } else {
      toast.success("הסף עודכן", { description: `התראה תופעל כשמספר המיכלים יורד מתחת ל-${threshold}` });
    }
  };

  const sendBroadcast = async () => {
    if (!message.trim()) {
      toast.error("נא להזין טקסט להתראה");
      return;
    }
    setSending(true);
    try {
      const res = await broadcast({ data: { message: message.trim(), target, title: "Pizza X" } });
      toast.success("ההתראה נשלחה", {
        description: `נשלחו ${res.sent} התראות (${res.targets} משתמשים, ${res.subscriptions} מכשירים)`,
      });
      setMessage("");
    } catch (e) {
      toast.error("שליחה נכשלה", { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <div>
        <h1 className="font-display text-2xl sm:text-3xl font-black flex items-center gap-2">
          <Bell className="h-7 w-7 text-neon" />
          ניהול התראות
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          ניהול סף התראות מלאי ושליחת הודעות יזומות לצוות.
        </p>
      </div>

      {/* Threshold config */}
      <section className="rounded-2xl border border-border bg-card p-5 space-y-3">
        <h2 className="font-bold flex items-center gap-2">
          <Settings2 className="h-5 w-5 text-neon" />
          סף התראת מלאי בצק
        </h2>
        <p className="text-xs text-muted-foreground">
          התראה אוטומטית תישלח לכל המנהלים כשמספר מיכלי הבצק יורד מתחת לערך זה.
        </p>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={1}
            max={999}
            value={threshold}
            onChange={(e) => setThreshold(parseInt(e.target.value, 10) || 0)}
            className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-base font-bold text-center"
          />
          <span className="text-sm text-muted-foreground">מיכלים</span>
          <button
            onClick={saveThreshold}
            disabled={thresholdSaving}
            className="rounded-md bg-neon px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50"
          >
            {thresholdSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "שמור"}
          </button>
        </div>
      </section>

      {/* Manual broadcast */}
      <section className="rounded-2xl border border-border bg-card p-5 space-y-3">
        <h2 className="font-bold flex items-center gap-2">
          <Send className="h-5 w-5 text-neon" />
          שליחת התראה ידנית
        </h2>

        <div className="space-y-2">
          <label className="block text-xs font-bold text-muted-foreground">טקסט ההתראה</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            maxLength={500}
            placeholder="לדוגמה: שיחת צוות דחופה בשעה 17:00, נא להגיע למטבח."
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm resize-none"
          />
          <div className="text-xs text-muted-foreground text-left">{message.length}/500</div>
        </div>

        <div className="space-y-2">
          <label className="block text-xs font-bold text-muted-foreground">קהל יעד</label>
          <select
            value={target}
            onChange={(e) => setTarget(e.target.value as "all" | "managers")}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-bold"
          >
            <option value="all">כל הצוות</option>
            <option value="managers">מנהלים בלבד</option>
          </select>
        </div>

        <button
          onClick={sendBroadcast}
          disabled={sending || !message.trim()}
          className="w-full rounded-md bg-neon px-4 py-3 text-base font-black text-primary-foreground disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
          {sending ? "שולח…" : "שלח התראה"}
        </button>
      </section>
    </div>
  );
}
