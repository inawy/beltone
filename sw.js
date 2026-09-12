const CACHE_NAME = "beltone-v1";

const APP_FILES = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.webmanifest",
  "./icons/icon.svg"
];


/* =========================================
   INSTALL
========================================= */

self.addEventListener(
  "install",
  event => {

    event.waitUntil(

      caches
        .open(CACHE_NAME)
        .then(cache =>
          cache.addAll(APP_FILES)
        )

    );

    self.skipWaiting();
  }
);


/* =========================================
   ACTIVATE
========================================= */

self.addEventListener(
  "activate",
  event => {

    event.waitUntil(

      caches
        .keys()
        .then(keys =>
          Promise.all(
            keys
              .filter(
                key =>
                  key !== CACHE_NAME
              )
              .map(
                key =>
                  caches.delete(key)
              )
          )
        )

    );

    self.clients.claim();
  }
);


/* =========================================
   FETCH
========================================= */

self.addEventListener(
  "fetch",
  event => {

    if (
      event.request.method !==
      "GET"
    ) {
      return;
    }


    event.respondWith(

      caches.match(
        event.request
      ).then(cached => {

        if (cached) {
          return cached;
        }


        return fetch(
          event.request
        ).then(response => {

          if (
            response &&
            response.status === 200 &&
            response.type === "basic"
          ) {

            const clone =
              response.clone();

            caches
              .open(CACHE_NAME)
              .then(cache => {

                cache.put(
                  event.request,
                  clone
                );

              });
          }


          return response;

        }).catch(() =>
          caches.match(
            "./index.html"
          )
        );

      })

    );
  }
);


/* =========================================
   NOTIFICATION CLICK
========================================= */

self.addEventListener(
  "notificationclick",
  event => {

    const notification =
      event.notification;

    const action =
      event.action;

    const id =
      notification.data?.id;


    notification.close();


    if (!id) {
      return;
    }


    if (action === "done") {

      event.waitUntil(
        notifyClients({
          type: "DONE",
          id
        })
      );

      return;
    }


    if (action === "snooze") {

      event.waitUntil(
        openAppWithAction(
          "snooze",
          id
        )
      );

      return;
    }


    event.waitUntil(
      openApp()
    );
  }
);


/* =========================================
   HELPERS
========================================= */

async function notifyClients(message) {

  const clients =
    await self.clients.matchAll({
      type: "window",
      includeUncontrolled: true
    });


  if (clients.length) {

    clients.forEach(client => {
      client.postMessage(message);
    });

    return;
  }


  await openAppWithAction(
    message.type === "DONE"
      ? "done"
      : "snooze",
    message.id
  );
}


async function openApp() {

  const clients =
    await self.clients.matchAll({
      type: "window",
      includeUncontrolled: true
    });


  if (clients.length) {

    return clients[0].focus();
  }


  return self.clients.openWindow(
    "./"
  );
}


async function openAppWithAction(
  action,
  id
) {

  const clients =
    await self.clients.matchAll({
      type: "window",
      includeUncontrolled: true
    });


  if (clients.length) {

    const client =
      clients[0];

    await client.focus();

    client.postMessage({
      type:
        action === "done"
          ? "DONE"
          : "SNOOZE",
      id
    });

    return;
  }


  return self.clients.openWindow(
    `./?action=${action}&id=${encodeURIComponent(
      id
    )}`
  );
}
