// Web Push subscription helpers (client-side).
// VAPID_PUBLIC_KEY is intentionally public — it must reach the browser.

import { supabase } from "@/integrations/supabase/client";
import { ensureServiceWorker } from "@/lib/notifications";

export const VAPID_PUBLIC_KEY =
  "BP6wu25SzuyLK2utGuarm25BetdHf_5IYS-5HxKucD0dV9gflbsHdv9jQVuuYT5JP_O9rVrJMUu3t27p7co-Bic";

export type PushSubscribeReason =
  | "unsupported"
  | "preview"
  | "ios-not-standalone"
  | "permission-denied"
  | "permission-dismissed"
  | "no-service-worker"
  | "subscribe-failed"
  | "save-failed";

export class PushSubscribeError extends Error {
  reason: PushSubscribeReason;
  cause?: unknown;
  constructor(reason: PushSubscribeReason, message: string, cause?: unknown) {
    super(message);
    this.reason = reason;
    this.cause = cause;
  }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

function bufToB64Url(buf: ArrayBuffer | null): string {
  if (!buf) return "";
  const bytes = new Uint8Array(buf);
  let str = "";
  for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const iOSUA = /iPad|iPhone|iPod/.test(ua);
  // iPadOS 13+ reports as Mac with touch
  const iPadOS = ua.includes("Mac") && (navigator as Navigator & { maxTouchPoints?: number }).maxTouchPoints! > 1;
  return iOSUA || iPadOS;
}

export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const mq = window.matchMedia?.("(display-mode: standalone)").matches;
  const iosStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  return Boolean(mq || iosStandalone);
}

function isPreviewOrIframe(): boolean {
  if (typeof window === "undefined") return true;
  try {
    if (window.self !== window.top) return true;
  } catch {
    return true;
  }
  const h = window.location.hostname;
  return h.includes("id-preview--") || h.includes("lovableproject.com");
}

export async function subscribeToPush(userId: string): Promise<void> {
  if (typeof window === "undefined") {
    throw new PushSubscribeError("unsupported", "SSR context");
  }
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    throw new PushSubscribeError("unsupported", "Push not supported in this browser");
  }
  if (isPreviewOrIframe()) {
    throw new PushSubscribeError(
      "preview",
      "התראות Push לא פעילות בתצוגה המקדימה — יש לפתוח את האתר המפורסם.",
    );
  }
  if (isIOS() && !isStandalone()) {
    throw new PushSubscribeError(
      "ios-not-standalone",
      "כדי לקבל התראות באייפון, יש להתקין את האפליקציה למסך הבית קודם.",
    );
  }

  if (Notification.permission === "denied") {
    throw new PushSubscribeError(
      "permission-denied",
      "הדפדפן חוסם התראות. אנא לחץ על המנעול בשורת הכתובת ואשר קבלת התראות.",
    );
  }
  if (Notification.permission !== "granted") {
    let res: NotificationPermission;
    try {
      res = await Notification.requestPermission();
    } catch (e) {
      throw new PushSubscribeError("permission-denied", "בקשת ההרשאה נכשלה", e);
    }
    if (res === "denied") {
      throw new PushSubscribeError(
        "permission-denied",
        "הדפדפן חוסם התראות. אנא לחץ על המנעול בשורת הכתובת ואשר קבלת התראות.",
      );
    }
    if (res !== "granted") {
      throw new PushSubscribeError("permission-dismissed", "ההרשאה לא אושרה");
    }
  }

  const reg = await ensureServiceWorker();
  if (!reg) {
    throw new PushSubscribeError("no-service-worker", "Service Worker לא נטען");
  }

  let sub: PushSubscription | null;
  try {
    sub = await reg.pushManager.getSubscription();
    if (!sub) {
      const key = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: key.buffer.slice(
          key.byteOffset,
          key.byteOffset + key.byteLength,
        ) as ArrayBuffer,
      });
    }
  } catch (e) {
    throw new PushSubscribeError(
      "subscribe-failed",
      e instanceof Error ? e.message : "ההרשמה ל-Push נכשלה",
      e,
    );
  }

  const json = sub.toJSON();
  const endpoint = sub.endpoint;
  const p256dh = json.keys?.p256dh ?? bufToB64Url(sub.getKey("p256dh"));
  const auth = json.keys?.auth ?? bufToB64Url(sub.getKey("auth"));

  const { error } = await supabase
    .from("push_subscriptions")
    .upsert(
      {
        user_id: userId,
        endpoint,
        p256dh,
        auth,
        user_agent: navigator.userAgent.slice(0, 200),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "endpoint" },
    );
  if (error) {
    throw new PushSubscribeError("save-failed", error.message, error);
  }
}
