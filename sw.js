const CACHE_NAME = "beltone-v1.1.0";

const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

/* =========================
   INSTALL
========================= */

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(APP_SHELL);
    })
  );

  self.skipWaiting();
});

/* =========================
   ACTIVATE
========================= */

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      );
    })
  );

  self.clients.claim();
});

/* =========================
   FETCH
========================= */

self.addEventListener("fetch", event => {
  const request = event.request;

  if (request.method !== "GET") {
    return;
  }

  event.respondWith(
    caches.match(request).then(cachedResponse => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(request)
        .then(response => {
          if (
            !response ||
            response.status !== 200 ||
            response.type === "opaque"
          ) {
            return response;
          }

          const responseClone =
            response.clone();

          caches.open(CACHE_NAME).then(cache => {
            cache.put(
              request,
              responseClone
            );
          });

          return response;
        })
        .catch(() => {
          return caches.match(
            "./index.html"
          );
        });
    })
  );
});

/* =========================
   NOTIFICATION CLICK
========================= */

self.addEventListener(
  "notificationclick",
  event => {
    event.notification.close();

    const action =
      event.action;

    const data =
      event.notification.data || {};

    const id =
      data.id;

    if (!id) {
      return;
    }

    event.waitUntil(
      clients.matchAll({
        type: "window",
        includeUncontrolled: true
      }).then(clientList => {

        const url =
          `./?action=${encodeURIComponent(
            action || "open"
          )}&id=${encodeURIComponent(id)}`;

        for (
          const client of clientList
        ) {
          if ("focus" in client) {
            client.navigate(url);
            return client.focus();
          }
        }

        if (clients.openWindow) {
          return clients.openWindow(url);
        }

      })
    );
  }
);
