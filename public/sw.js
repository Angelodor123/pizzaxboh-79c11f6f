// Pizza X Service Worker — notifications + minimal asset cache for PWA installability.

const STATIC_CACHE = "pizzax-static-v1";
const STATIC_ASSETS = ["/", "/manifest.json", "/pizza-x-logo.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(STATIC_CACHE).then((c) => c.addAll(STATIC_ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then((keys) =>
        Promise.all(keys.filter((k) => k !== STATIC_CACHE).map((k) => caches.delete(k)))
      ),
    ])
  );
});

// Network-first for navigations (always fresh HTML), cache fallback when offline.
// Cache-first for same-origin static assets.
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(() => caches.match("/").then((r) => r || Response.error()))
    );
    return;
  }

  if (/\.(?:png|jpg|jpeg|svg|webp|ico|woff2?|ttf|css|js)$/i.test(url.pathname)) {
    event.respondWith(
      caches.match(req).then(
        (cached) =>
          cached ||
          fetch(req).then((res) => {
            const copy = res.clone();
            caches.open(STATIC_CACHE).then((c) => c.put(req, copy)).catch(() => {});
            return res;
          })
      )
    );
  }
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
