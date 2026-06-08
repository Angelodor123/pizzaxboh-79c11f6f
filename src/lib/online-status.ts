import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

// Shared, app-wide "real" online state.
// We don't fully trust navigator.onLine — on Android WebViews / PWAs it often
// gets stuck on `false` after the app was backgrounded, even when there's a
// perfectly good connection. We verify with a tiny network probe and only
// flip to "offline" once the probe also confirms it.

let currentOnline: boolean =
  typeof navigator === "undefined" ? true : navigator.onLine;
const listeners = new Set<(v: boolean) => void>();

function emit(next: boolean) {
  if (next === currentOnline) return;
  currentOnline = next;
  listeners.forEach((l) => {
    try {
      l(next);
    } catch {
      /* ignore */
    }
  });
}

let probing = false;
let lastProbeAt = 0;
const PROBE_TIMEOUT_MS = 4000;
const PROBE_MIN_INTERVAL_MS = 5000;

async function probeConnection(): Promise<boolean> {
  if (typeof window === "undefined") return true;
  const now = Date.now();
  if (probing) return currentOnline;
  if (now - lastProbeAt < PROBE_MIN_INTERVAL_MS) return currentOnline;
  probing = true;
  lastProbeAt = now;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), PROBE_TIMEOUT_MS);
    // Use Supabase's auth health endpoint — small, CORS-enabled, no auth needed.
    // Fall back to a cache-busted same-origin HEAD if that fails.
    const url = `${(supabase as unknown as { supabaseUrl: string }).supabaseUrl}/auth/v1/health?cb=${now}`;
    let ok = false;
    try {
      const res = await fetch(url, {
        method: "GET",
        cache: "no-store",
        signal: ctrl.signal,
      });
      ok = res.ok || res.status === 401 || res.status === 404;
    } catch {
      try {
        const res2 = await fetch(`/?cb=${now}`, {
          method: "HEAD",
          cache: "no-store",
          signal: ctrl.signal,
        });
        ok = res2.ok;
      } catch {
        ok = false;
      }
    }
    clearTimeout(t);
    emit(ok);
    return ok;
  } finally {
    probing = false;
  }
}

let bootstrapped = false;
function bootstrap() {
  if (bootstrapped || typeof window === "undefined") return;
  bootstrapped = true;
  const onOnline = () => {
    // Browser thinks we're back — trust the optimistic flip immediately.
    emit(true);
    void probeConnection();
  };
  const onOffline = () => {
    // Don't trust the pessimistic flip — verify before showing the banner.
    void probeConnection();
  };
  window.addEventListener("online", onOnline);
  window.addEventListener("offline", onOffline);
  window.addEventListener("focus", () => void probeConnection());
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void probeConnection();
  });
  // Periodic probe — only when the browser claims we're offline, so we
  // recover from stuck `navigator.onLine === false` states automatically.
  setInterval(() => {
    if (!navigator.onLine || !currentOnline) void probeConnection();
  }, 15000);
  // Initial verification on boot if browser claims offline.
  if (!navigator.onLine) void probeConnection();
}

export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState<boolean>(currentOnline);
  useEffect(() => {
    bootstrap();
    listeners.add(setOnline);
    setOnline(currentOnline);
    return () => {
      listeners.delete(setOnline);
    };
  }, []);
  return online;
}

/** Returns true if a mutation should proceed; otherwise shows a toast and returns false. */
export function guardOnlineMutation(actionLabel = "פעולה זו"): boolean {
  if (typeof navigator !== "undefined" && !navigator.onLine && !currentOnline) {
    toast.error("אין חיבור לאינטרנט", {
      description: `${actionLabel} לא תישמר ללא חיבור. נסה שוב כשהחיבור יחזור.`,
    });
    return false;
  }
  return true;
}

/** Force an immediate connectivity probe (e.g. user tapped the offline chip). */
export function recheckOnlineStatus(): Promise<boolean> {
  lastProbeAt = 0;
  return probeConnection();
}
