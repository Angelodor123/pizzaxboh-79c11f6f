// Web Push subscription helpers (client-side).
// VAPID_PUBLIC_KEY is intentionally public — it must reach the browser.

import { supabase } from "@/integrations/supabase/client";
import { ensureServiceWorker } from "@/lib/notifications";

export const VAPID_PUBLIC_KEY =
  "BP6wu25SzuyLK2utGuarm25BetdHf_5IYS-5HxKucD0dV9gflbsHdv9jQVuuYT5JP_O9rVrJMUu3t27p7co-Bic";

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

export async function subscribeToPush(userId: string): Promise<boolean> {
  try {
    if (typeof window === "undefined") return false;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return false;
    if (Notification.permission !== "granted") {
      const res = await Notification.requestPermission();
      if (res !== "granted") return false;
    }
    const reg = await ensureServiceWorker();
    if (!reg) return false;

    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    }

    const json = sub.toJSON();
    const endpoint = sub.endpoint;
    const p256dh = json.keys?.p256dh ?? bufToB64Url(sub.getKey("p256dh"));
    const auth = json.keys?.auth ?? bufToB64Url(sub.getKey("auth"));

    await supabase
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
    return true;
  } catch (e) {
    console.warn("subscribeToPush failed", e);
    return false;
  }
}
