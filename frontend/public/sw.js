const CACHE_NAME = 'nam-phuong-erp-v3';

// Install: skip waiting immediately, no pre-caching (assets change every build)
self.addEventListener('install', () => {
  self.skipWaiting();
});

// Activate: delete all old caches, claim clients
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch: network-first, no caching of JS/CSS assets (they have content hashes)
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Never cache API calls or WebSocket upgrades
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/ws')) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Only cache the app shell (HTML), not hashed JS/CSS chunks
        if (url.pathname === '/' || url.pathname === '/index.html') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() =>
        caches.match(event.request).then(
          (cached) =>
            cached ||
            new Response('Offline', { status: 503, statusText: 'Service Unavailable' })
        )
      )
  );
});
