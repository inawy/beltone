'use strict';

/* =========================================================
   BELTONE SERVICE WORKER
   - Precaches the app shell so the app opens with no network.
   - Cache-first for the shell, stale-while-revalidate for the
     Google Fonts files so the first online visit caches the
     font and every visit after that — online or offline —
     uses it instantly.
   - Handles the Done / Snooze buttons on a notification even
     if the app window isn't open at the time.
   ========================================================= */

const CACHE_VERSION = 'v2';
const SHELL_CACHE = `beltone-shell-${CACHE_VERSION}`;
const FONT_CACHE = `beltone-fonts-${CACHE_VERSION}`;

const SHELL_URLS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key !== SHELL_CACHE && key !== FONT_CACHE)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  const isFont = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  const isSameOrigin = url.origin === self.location.origin;

  if (isFont) {
    event.respondWith(staleWhileRevalidate(request, FONT_CACHE));
    return;
  }

  if (isSameOrigin) {
    event.respondWith(cacheFirst(request));
  }
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response && response.ok) {
      const cache = await caches.open(SHELL_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const fallback = await caches.match('./index.html');
    if (fallback) return fallback;
    throw error;
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const networkFetch = fetch(request)
    .then((response) => {
      if (response && response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);

  return cached || networkFetch || Response.error();
}

/* =========================================================
   NOTIFICATION ACTIONS
   Tapping "Done" or "Snooze" on a Beltone notification lands
   here even with no app window open. If a window is already
   open we message it directly; otherwise we open one with the
   action encoded in the URL, which index.html reads on load.
   ========================================================= */
self.addEventListener('notificationclick', (event) => {
  const reminderId = event.notification.data && event.notification.data.id;
  const action = event.action; // 'done' | 'snooze' | '' (notification body tapped)

  event.notification.close();
  if (!reminderId) return;

  event.waitUntil(handleNotificationClick(reminderId, action));
});

async function handleNotificationClick(reminderId, action) {
  const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });

  if (action === 'done' || action === 'snooze') {
    const openClient = allClients.find((client) => 'focus' in client);
    if (openClient) {
      openClient.postMessage({ type: action === 'done' ? 'DONE' : 'SNOOZE', id: reminderId });
      openClient.focus();
      return;
    }

    const targetUrl = `./index.html?action=${action}&id=${encodeURIComponent(reminderId)}`;
    if (self.clients.openWindow) {
      await self.clients.openWindow(targetUrl);
    }
    return;
  }

  // Notification body tapped (no action button) — just bring the app forward.
  const openClient = allClients.find((client) => 'focus' in client);
  if (openClient) {
    openClient.focus();
    return;
  }
  if (self.clients.openWindow) {
    await self.clients.openWindow('./index.html');
  }
}
