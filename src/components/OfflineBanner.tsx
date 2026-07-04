import { WifiOff, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useOnlineStatus } from "@/lib/online-status";
import { subscribeQueueCount, flushQueue } from "@/lib/offline-queue";

export function OfflineBanner() {
  const online = useOnlineStatus();
  const [queueCount, setQueueCount] = useState(0);

  useEffect(() => {
    return subscribeQueueCount(setQueueCount);
  }, []);

  useEffect(() => {
    if (online && queueCount > 0) {
      void flushQueue();
    }
  }, [online, queueCount]);

  if (!online) {
    return (
      <div
        className="sticky top-0 z-[60] w-full bg-amber-500 text-black border-b-2 border-amber-700 px-3 py-1.5 text-center text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-lg"
        role="alert"
      >
        <div className="flex items-center gap-2 flex-1 justify-center">
          <WifiOff className="h-4 w-4" />
          אין חיבור לאינטרנט — מוצג מידע שמור. שינויים לא יישמרו עד שהחיבור יחזור.
        </div>
        {queueCount > 0 && (
          <span className="shrink-0 bg-amber-900 text-amber-100 rounded-full px-2 py-0.5 text-[10px] font-bold">
            {queueCount} בהמתנה
          </span>
        )}
      </div>
    );
  }

  if (queueCount > 0) {
    return (
      <div className="sticky top-0 z-[61] w-full bg-neon/10 border-b border-neon/30 px-3 py-1 flex items-center justify-center gap-2 text-xs text-neon font-bold">
        <Loader2 className="animate-spin h-3 w-3" />
        מסנכרן {queueCount} פעולות
      </div>
    );
  }

  return null;
}
