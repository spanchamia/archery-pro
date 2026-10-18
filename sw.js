// Service worker: keeps a copy of the app on the device so it opens with no
// internet connection. Files are served from the cache straight away and
// refreshed in the background whenever the device is online, so updates
// show up on the next launch.

const CACHE = 'archery-pro-v7';
const APP_FILES = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/styles.css',
  'js/app.js',
  'js/chart.js',
  'js/scoring.js',
  'js/storage.js',
  'js/theme.js',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      // `reload` skips the browser's HTTP cache so we store fresh copies.
      .then((cache) => cache.addAll(APP_FILES.map((url) => new Request(url, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      // Version query strings (?v=7) are only for browser cache busting.
      const cached = await cache.match(request, { ignoreSearch: true });
      // `no-cache` revalidates with the server instead of reusing the
      // browser's HTTP cache, so updates aren't held back.
      const network = fetch(request, { cache: 'no-cache' })
        .then((response) => {
          if (response.ok) cache.put(request.url.split('?')[0], response.clone());
          return response;
        })
        .catch(() => null);

      if (cached) {
        event.waitUntil(network);
        return cached;
      }
      const response = await network;
      if (response) return response;
      // Offline and never cached: fall back to the app shell for page loads.
      if (request.mode === 'navigate') return cache.match('./');
      return Response.error();
    })
  );
});
