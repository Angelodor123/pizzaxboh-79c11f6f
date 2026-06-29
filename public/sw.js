// Pizza X Service Worker — notifications only.
// It intentionally does not cache pages or app assets, so users always receive
// the latest published app instead of stale error pages or old JS chunks.

const OLD_APP_CACHE_PREFIX = "pizzax-static-";

self.addEventListener("install", (e) => {
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then((keys) =>
        Promise.all(keys.filter((k) => k.startsWith(OLD_APP_CACHE_PREFIX)).map((k) => caches.delete(k)))
      ),
    ])
  );
});

// Allow page to ask SW to show a notification (works while SW is alive, even
// if the tab/PWA is backgrounded or the screen is locked).
self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type === "SHOW_NOTIFICATION") {
    const { title, body, tag, icon, badge } = data;
    self.registration.showNotification(title || "Pizza X", {
      body: body || "",
      tag: tag || undefined,
      icon: icon || "/pizza-x-logo.png",
      badge: badge || "/pizza-x-logo.png",
      vibrate: [200, 100, 200, 100, 400],
      requireInteraction: true,
      dir: "rtl",
      lang: "he",
    });
  }
});

// Optional: push payload support (if a backend ever sends real web-push).
self.addEventListener("push", (event) => {
  let payload = { title: "Pizza X", body: "" };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch {
    if (event.data) payload.body = event.data.text();
  }
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/pizza-x-logo.png",
      badge: "/pizza-x-logo.png",
      vibrate: [200, 100, 200, 100, 400],
      requireInteraction: true,
      dir: "rtl",
      lang: "he",
      tag: payload.tag,
      data: { url: payload.url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const c of clients) {
        if ("focus" in c) {
          if ("navigate" in c) {
            return c.navigate(targetUrl).then(() => c.focus()).catch(() => c.focus());
          }
          return c.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    }),
  );
});
