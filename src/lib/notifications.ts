// Native notifications via Service Worker.
// Works while the SW is alive (PWA installed, or tab still open in background).
// Skips registration inside the Lovable editor preview iframe to avoid the
// known preview-iframe issues with service workers.

const SW_URL = "/sw.js";

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

let registrationPromise: Promise<ServiceWorkerRegistration | null> | null = null;

export function ensureServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (registrationPromise) return registrationPromise;
  registrationPromise = (async () => {
    if (typeof window === "undefined") return null;
    if (!("serviceWorker" in navigator)) return null;
    if (isPreviewOrIframe()) {
      // Cleanup any stale SW left over from previous tests
      try {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      } catch {}
      return null;
    }
    try {
      return await navigator.serviceWorker.register(SW_URL, { scope: "/" });
    } catch (e) {
      console.warn("SW registration failed", e);
      return null;
    }
  })();
  return registrationPromise;
}

export function notificationsSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "Notification" in window &&
    "serviceWorker" in navigator &&
    !isPreviewOrIframe()
  );
}

export function notificationPermission(): NotificationPermission | "unsupported" {
  if (!notificationsSupported()) return "unsupported";
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<NotificationPermission | "unsupported"> {
  if (!notificationsSupported()) return "unsupported";
  if (Notification.permission !== "default") return Notification.permission;
  try {
    const result = await Notification.requestPermission();
    if (result === "granted") void ensureServiceWorker();
    return result;
  } catch {
    return "denied";
  }
}

export async function notify(
  title: string,
  options: { body?: string; tag?: string } = {},
): Promise<boolean> {
  if (!notificationsSupported()) return false;
  if (Notification.permission !== "granted") return false;
  const reg = await ensureServiceWorker();
  if (reg) {
    try {
      await reg.showNotification(title, {
        body: options.body,
        tag: options.tag,
        icon: "/pizza-x-logo.png",
        badge: "/pizza-x-logo.png",
        vibrate: [200, 100, 200, 100, 400],
        requireInteraction: true,
        dir: "rtl",
        lang: "he",
      } as NotificationOptions);
      return true;
    } catch {
      // fall through to fallback
    }
  }
  try {
    new Notification(title, { body: options.body, tag: options.tag, icon: "/pizza-x-logo.png" });
    return true;
  } catch {
    return false;
  }
}
