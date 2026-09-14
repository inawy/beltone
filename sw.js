const CACHE_NAME = "beltone-cache-v1";
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icons/icon.svg",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Network-first for navigations, cache-first for static assets.
// A fetch handler is required for the app to be considered installable.
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() => caches.match("./index.html"))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      return (
        cached ||
        fetch(event.request).then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return response;
        }).catch(() => cached)
      );
    })
  );
});

// Handles the "Done" / "Snooze" buttons on the reminder notification.
self.addEventListener("notificationclick", (event) => {
  const id = event.notification.data && event.notification.data.id;
  const action = event.action; // "done" | "snooze" | "" (body click)

  event.notification.close();
  if (!id) return;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((client) => "focus" in client);

      if (existing) {
        existing.focus();
        if (action === "done" || action === "snooze") {
          existing.postMessage({ type: action.toUpperCase(), id });
        }
        return;
      }

      const query = action ? `?action=${action}&id=${encodeURIComponent(id)}` : "";
      return self.clients.openWindow(`./index.html${query}`);
    })
  );
});
