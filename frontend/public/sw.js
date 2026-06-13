const CACHE_NAME = 'nam-phuong-erp-v17';

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

// Push: hiện notification khi server gửi lệnh mới
self.addEventListener('push', (event) => {
  let data = { title: 'Nam Phương ERP', body: 'Có thông báo mới' };
  try { data = JSON.parse(event.data.text()); } catch {}
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/logo_namphuong.png',
      badge: '/logo_namphuong.png',
      tag: 'erp-push',
      renotify: true,
      vibrate: [100, 50, 100],
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url.includes('/production') && 'focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow('/');
    })
  );
});

// Fetch: network-first, no caching of JS/CSS assets (they have content hashes)
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Never intercept cross-origin requests (Google Fonts, CDN, etc.)
  if (url.origin !== self.location.origin) return;

  // Never cache API calls or WebSocket upgrades
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/ws')) return;

  // Navigation requests: fallback to cached index.html when offline
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() =>
        caches.match('/') || caches.match('/index.html') ||
        new Response('Offline', { status: 503, statusText: 'Service Unavailable' })
      )
    );
    return;
  }

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
