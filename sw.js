/* =========================================================
   Beltone Service Worker
   Strategy:
   - HTML (navigation): network-first
   - Assets: cache-first
   ========================================================= */

const CACHE_NAME = "beltone-v1.2.0";

const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icons/icon.svg",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

/* ---------- INSTALL ---------- */
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.allSettled(APP_SHELL.map((url) => cache.add(url)))
    )
  );
  self.skipWaiting();
});

/* ---------- ACTIVATE ---------- */
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

/* ---------- FETCH ---------- */
self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // فقط نفس الأصل
  if (url.origin !== self.location.origin) return;

  const isHTML =
    request.mode === "navigate" ||
    (request.headers.get("accept") || "").includes("text/html");

  // ============ HTML: network-first ============
  if (isHTML) {
    // لا نخزّن URLs مع query string (action URLs)
    if (url.search) {
      event.respondWith(fetch(request));
      return;
    }

    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() =>
          caches.match(request).then(
            (r) => r || caches.match("./index.html")
          )
        )
    );
    return;
  }

  // ============ Assets: cache-first ============
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;

      return fetch(request).then((response) => {
        if (
          !response ||
          response.status !== 200 ||
          response.type === "opaque"
        ) {
          return response;
        }

        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        return response;
      });
    })
  );
});

/* ---------- NOTIFICATION CLICK ---------- */
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const action = event.action; // "done" | "snooze" | ""
  const data = event.notification.data || {};
  const id = data.id;

  if (!id) return;

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        const client = clientList[0];

        // التاب مفتوح: أرسل رسالة، لا تعيد التحميل
        if (client && client.postMessage) {
          if (action === "done" || action === "snooze") {
            client.postMessage({ type: action.toUpperCase(), id });
          }
          return client.focus();
        }

        // التاب مغلق: افتح التطبيق مع query string
        const url = new URL("./", self.registration.scope);

        if (action === "done" || action === "snooze") {
          url.searchParams.set("action", action);
          url.searchParams.set("id", id);
        }

        return self.clients.openWindow(url.href);
      })
  );
});
