// Service Worker do Web App (Vercel) — estudo offline
// Estratégias: app shell pré-cacheado; stale-while-revalidate pra estáticos;
// navegação network-first com fallback pro shell; Supabase NUNCA é cacheado.
const CACHE_NAME = 'linguaflow-v2.0.0';

// URLs como o Vercel serve de verdade (via rewrites de vercel.json)
const APP_SHELL = [
  '/',
  '/css/globals.css',
  '/manifest.webmanifest',
  '/icons/icon192.png',
  '/icons/icon512.png',
  '/icons/icon128.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      // addAll atômico falharia tudo se 1 URL der 404; cacheia um a um
      .then((cache) => Promise.allSettled(APP_SHELL.map((u) => cache.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.map((n) => (n !== CACHE_NAME ? caches.delete(n) : undefined)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Dados dinâmicos e escrita: sempre rede, nunca cache
  if (req.method !== 'GET') return;
  if (url.hostname.includes('supabase.co')) return;
  if (url.origin !== self.location.origin) return; // TTS/Google etc: deixa passar

  // Navegação (rotas do SPA): rede primeiro, fallback pro shell cacheado
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put('/', copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match('/'))
    );
    return;
  }

  // Estáticos (js/css/imagens): stale-while-revalidate —
  // responde do cache na hora e atualiza em segundo plano
  event.respondWith(
    caches.match(req).then((cached) => {
      const fetched = fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => cached);
      return cached || fetched;
    })
  );
});
