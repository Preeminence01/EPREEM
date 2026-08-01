/* ==========================================================================
   EPREEM — Service Worker
   Caches the static app shell (HTML/CSS/JS) so the PWA installs cleanly and
   loads instantly on repeat visits. API calls (/api/...) are always fetched
   fresh from the network — we never cache live marketplace data.
   ========================================================================== */

const CACHE_NAME = 'epreem-shell-v19';

const SHELL_ASSETS = [
  './',
  './index.html',
  './login.html',
  './admin-login.html',
  './admin-dashboard.html',
  './register.html',
  './forgot-password.html',
  './reset-password.html',
  './browse.html',
  './product.html',
  './auctions.html',
  './cart.html',
  './checkout.html',
  './order-detail.html',
  './notifications.html',
  './seller-dashboard.html',
  './messages.html',
  './profile.html',
  './about.html',
  './trust.html',
  './support.html',
  './terms.html',
  './css/style.css',
  './js/config.js',
  './js/api.js',
  './js/app.js',
  './js/password-visibility.js',
  './manifest.json',
  './logo.jpg',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Never cache API calls — always hit the Laravel backend live.
  if (url.pathname.startsWith('/api/') || url.port === '8000') {
    return;
  }

  if (event.request.method !== 'GET') return;

  // HTML navigations must prefer the latest deployment. The previous
  // cache-first strategy could keep an installed browser on an older header
  // until it was opened a second time.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.ok) {
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, response.clone()));
          }
          return response;
        })
        .catch(() => caches.match(event.request).then((cached) => cached || caches.match('./index.html')))
    );
    return;
  }

  // Styles and scripts control the responsive UI. Fetch them first so mobile
  // layout changes appear as soon as a new deployment is available; use the
  // cached copy only when the device is offline.
  const isUiAsset = /\.(?:css|js)$/i.test(url.pathname);
  if (isUiAsset) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.ok) {
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, response.clone()));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request)
        .then((response) => {
          if (response && response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
