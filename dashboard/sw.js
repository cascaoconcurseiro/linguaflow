// Service Worker do Web App (Vercel) — estudo offline
// Estratégias: app shell pré-cacheado; network-first para código;
// navegação network-first com fallback pro shell; Supabase NUNCA é cacheado.
const CACHE_NAME = 'linguaflow-v3.0.13';

// URLs como o Vercel serve de verdade (via rewrites de vercel.json)
const APP_SHELL = [
  '/',
  '/css/globals.css',
  '/manifest.webmanifest',
  '/icons/icon192.png',
  '/icons/icon512.png',
  '/icons/icon128.png'
];

// Pedido do dono (18/07): o banner "Atualizar" manda esta mensagem; o
// worker novo assume na hora e o controllerchange do app recarrega a página.
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

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

  // Código precisa ser coerente com o schema/RPC do deploy atual. Servir JS
  // antigo enquanto o HTML é novo causou INSERT direto em review_log (403)
  // mesmo depois da RPC atômica estar publicada. Online: rede primeiro;
  // offline: a última versão confirmada continua disponível.
  if (req.destination === 'script' || req.destination === 'style'
      || url.pathname.endsWith('.js') || url.pathname.endsWith('.css')) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // Imagens/manifest: stale-while-revalidate.
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

// ── WEB PUSH (lembrete diário — opt-in nas Configurações) ────────────────────
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { /* payload não-JSON */ }
  const title = data.title || 'LinguaFlow';
  event.waitUntil(self.registration.showNotification(title, {
    body: data.body || 'Você tem revisões esperando.',
    tag: data.tag || 'linguaflow-reminder',
    icon: '/icons/icon192.png',
    badge: '/icons/icon128.png',
    data: { url: data.url || '/study' },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = event.notification.data?.url || '/study';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          client.focus();
          if ('navigate' in client) client.navigate(target).catch(() => {});
          return;
        }
      }
      return self.clients.openWindow(target);
    })
  );
});
