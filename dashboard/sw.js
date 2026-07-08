const CACHE_NAME = 'linguaflow-v1.0.1';
const ASSETS_TO_CACHE = [
  './dashboard.html',
  './css/globals.css',
  './manifest.webmanifest',
  './js/core/app.js',
  '../utils/db.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS_TO_CACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // We only want to cache our static local assets, not the Supabase API calls.
  if (event.request.url.includes('supabase.co')) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Return cached version if found, else fetch from network
        return response || fetch(event.request).catch(() => {
          // Fallback if offline
          console.warn('Network request failed and no cache available for: ', event.request.url);
        });
      })
  );
});
