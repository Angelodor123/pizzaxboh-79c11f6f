import { useEffect, useState } from "react";
import { toast } from "sonner";

export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState<boolean>(
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}

/** Returns true if a mutation should proceed; otherwise shows a toast and returns false. */
export function guardOnlineMutation(actionLabel = "פעולה זו"): boolean {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    toast.error("אין חיבור לאינטרנט", {
      description: `${actionLabel} לא תישמר ללא חיבור. נסה שוב כשהחיבור יחזור.`,
    });
    return false;
  }
  return true;
}
