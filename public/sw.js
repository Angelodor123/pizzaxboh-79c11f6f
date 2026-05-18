// Pizza X Service Worker — minimal, for native notifications.
// No caching strategy: HTML is always fetched fresh, no offline shell.

self.addEventListener("install", (e) => {
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(self.clients.claim());
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
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const c of clients) {
        if ("focus" in c) return c.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow("/");
    }),
  );
});
