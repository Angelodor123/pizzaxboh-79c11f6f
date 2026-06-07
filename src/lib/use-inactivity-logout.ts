import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;
const WARNING_MS = 5 * 60 * 1000; // warn 5 min before logout
const STORAGE_KEY = "pizzax-last-activity";
const ACTIVITY_EVENTS = [
  "mousedown",
  "keydown",
  "touchstart",
  "scroll",
  "visibilitychange",
] as const;

/**
 * Auto-logout after 12 hours of inactivity. Designed for shared kitchen
 * tablets — cooks shouldn't be forced to re-auth mid-service, but the
 * session should not stay open overnight on an unattended device.
 *
 * - Tracks activity across tabs via localStorage.
 * - Shows a toast warning 5 minutes before signing out.
 * - Only runs while the user is signed in.
 */
export function useInactivityLogout(isSignedIn: boolean) {
  const warnedRef = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!isSignedIn || typeof window === "undefined") return;

    const stamp = () => {
      try {
        localStorage.setItem(STORAGE_KEY, String(Date.now()));
      } catch {
        /* ignore quota / private mode errors */
      }
      warnedRef.current = false;
    };

    const readLast = (): number => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        const n = raw ? Number(raw) : NaN;
        return Number.isFinite(n) ? n : Date.now();
      } catch {
        return Date.now();
      }
    };

    // Seed activity on mount
    stamp();

    const handleActivity = () => stamp();
    ACTIVITY_EVENTS.forEach((ev) =>
      window.addEventListener(ev, handleActivity, { passive: true }),
    );

    const check = async () => {
      const last = readLast();
      const idle = Date.now() - last;

      if (idle >= TWELVE_HOURS_MS) {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        try {
          await supabase.auth.signOut();
        } catch {
          /* ignore */
        }
        toast.warning("הופסקת אוטומטית", {
          description: "המכשיר היה לא פעיל יותר מ-12 שעות. התחבר מחדש כדי להמשיך.",
          duration: 10_000,
        });
        return;
      }

      if (idle >= TWELVE_HOURS_MS - WARNING_MS && !warnedRef.current) {
        warnedRef.current = true;
        toast.warning("יציאה אוטומטית בקרוב", {
          description: "המכשיר ייצא מהמערכת תוך 5 דקות עקב חוסר פעילות. גע במסך כדי להישאר מחובר.",
          duration: 15_000,
        });
      }
    };

    // Check every minute (cheap; just a localStorage read)
    intervalRef.current = setInterval(check, 60_000);

    return () => {
      ACTIVITY_EVENTS.forEach((ev) =>
        window.removeEventListener(ev, handleActivity),
      );
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isSignedIn]);
}
