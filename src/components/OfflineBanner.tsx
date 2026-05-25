import { WifiOff } from "lucide-react";
import { useOnlineStatus } from "@/lib/online-status";

export function OfflineBanner() {
  const online = useOnlineStatus();
  if (online) return null;
  return (
    <div
      className="sticky top-0 z-[60] w-full bg-amber-500 text-black border-b-2 border-amber-700 px-3 py-1.5 text-center text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-lg"
      role="alert"
    >
      <WifiOff className="h-4 w-4" />
      אין חיבור לאינטרנט — מוצג מידע שמור. שינויים לא יישמרו עד שהחיבור יחזור.
    </div>
  );
}
