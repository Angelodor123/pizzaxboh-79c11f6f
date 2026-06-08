// Tiny floating chip showing how many actions are queued for retry.
// Renders nothing when the queue is empty.
import { useEffect, useState } from "react";
import { CloudOff, Loader2, RefreshCw } from "lucide-react";
import { subscribeQueueCount, flushQueue } from "@/lib/offline-queue";
import { useOnlineStatus, recheckOnlineStatus } from "@/lib/online-status";
import { toast } from "sonner";

export function OfflineQueueIndicator() {
  const [count, setCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const online = useOnlineStatus();

  useEffect(() => {
    const unsub = subscribeQueueCount(setCount);
    return () => { unsub; };
  }, []);

  if (count === 0) return null;

  return (
    <div
      dir="rtl"
      className="fixed bottom-3 left-3 z-[60] flex items-center gap-2 rounded-full border border-border bg-background/95 backdrop-blur px-3 py-1.5 shadow-lg text-xs"
    >
      {!online ? (
        <button
          onClick={async () => {
            const ok = await recheckOnlineStatus();
            toast[ok ? "success" : "error"](
              ok ? "החיבור חזר" : "עדיין אין חיבור — נסה שוב בעוד רגע",
            );
          }}
          className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition"
          title="בדוק חיבור שוב"
        >
          <CloudOff className="h-3.5 w-3.5 text-amber-500" />
          <span>לא מקוון</span>
        </button>
      ) : busy ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <RefreshCw className="h-3.5 w-3.5 text-neon" />
      )}
      {count > 0 && (
        <button
          onClick={async () => {
            if (!online || busy) return;
            setBusy(true);
            try {
              await flushQueue();
            } finally {
              setBusy(false);
            }
          }}
          className="font-bold tabular-nums text-foreground hover:text-neon transition"
        >
          {count} פעולות בהמתנה
        </button>
      )}
    </div>
  );
}
