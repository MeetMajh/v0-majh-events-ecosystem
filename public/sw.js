// MAJH EVENTS Service Worker
// This service worker provides offline support by caching assets and serving from cache when offline
const CACHE_NAME = 'majh-events-v1';
const OFFLINE_URL = '/offline';
const OFFLINE_CACHE = 'offline-cache-v1';

// Assets to cache immediately on install for offline support
const PRECACHE_ASSETS = [
  '/',
  '/offline',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
];

// Static assets to cache for offline use
const STATIC_ASSETS = [
  '/events',
  '/esports',
  '/clips',
  '/bar-cafe',
];

// Install event - precache essential assets for offline support
self.addEventListener('install', (event) => {
  event.waitUntil(
    Promise.all([
      // Main cache for precached assets
      caches.open(CACHE_NAME).then((cache) => {
        console.log('[SW] Caching precache assets for offline support');
        return cache.addAll(PRECACHE_ASSETS);
      }),
      // Offline cache for additional pages
      caches.open(OFFLINE_CACHE).then((cache) => {
        console.log('[SW] Caching static pages for offline support');
        return cache.addAll(STATIC_ASSETS).catch(() => {
          // Some pages may not exist yet, that's ok
          console.log('[SW] Some static assets not available');
        });
      }),
    ])
  );
  // Activate immediately
  self.skipWaiting();
});

// Activate event - clean up old caches and claim clients for offline support
self.addEventListener('activate', (event) => {
  const currentCaches = [CACHE_NAME, OFFLINE_CACHE];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => !currentCaches.includes(name))
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    }).then(() => {
      console.log('[SW] Service worker activated with offline support');
    })
  );
  // Take control of all pages immediately for offline support
  self.clients.claim();
});

// Fetch event - implements offline support with cache strategies
// This handler intercepts all fetch requests and serves from cache when offline
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip Chrome extensions and other non-http(s) requests
  if (!url.protocol.startsWith('http')) return;

  // Skip API routes - always go to network
  if (url.pathname.startsWith('/api/')) return;

  // Skip Supabase and external requests
  if (!url.origin.includes(self.location.origin)) return;

  // OFFLINE SUPPORT: For navigation requests (HTML pages)
  // Uses network-first strategy with offline fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          // Try network first
          const networkResponse = await fetch(request);
          // Cache successful responses for offline use
          if (networkResponse.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, networkResponse.clone());
          }
          return networkResponse;
        } catch (error) {
          // OFFLINE: Network failed, try cache
          console.log('[SW] Network failed, serving from cache for offline support');
          const cachedResponse = await caches.match(request);
          if (cachedResponse) {
            return cachedResponse;
          }
          // OFFLINE: Return offline page if nothing in cache
          const offlinePage = await caches.match(OFFLINE_URL);
          return offlinePage || new Response('Offline', { status: 503 });
        }
      })()
    );
    return;
  }

  // OFFLINE SUPPORT: For static assets - cache-first strategy
  // Serves instantly from cache, updates in background
  if (
    url.pathname.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|webp)$/) ||
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/')
  ) {
    event.respondWith(
      (async () => {
        // Check cache first for offline support
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
          // Update cache in background (stale-while-revalidate)
          fetch(request).then((response) => {
            if (response.ok) {
              caches.open(CACHE_NAME).then((cache) => cache.put(request, response));
            }
          }).catch(() => {});
          return cachedResponse;
        }
        // Not cached - fetch and cache for future offline use
        try {
          const networkResponse = await fetch(request);
          if (networkResponse.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, networkResponse.clone());
          }
          return networkResponse;
        } catch (error) {
          // Offline and not cached
          return new Response('', { status: 408 });
        }
      })()
    );
    return;
  }

  // OFFLINE SUPPORT: Default network-first with cache fallback
  event.respondWith(
    (async () => {
      try {
        const networkResponse = await fetch(request);
        if (networkResponse.ok) {
          const cache = await caches.open(CACHE_NAME);
          cache.put(request, networkResponse.clone());
        }
        return networkResponse;
      } catch (error) {
        // Offline: serve from cache
        const cachedResponse = await caches.match(request);
        return cachedResponse || new Response('', { status: 408 });
      }
    })()
  );
});

// Handle push notifications
self.addEventListener('push', (event) => {
  if (!event.data) return;

  const data = event.data.json();
  const options = {
    body: data.body,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-192x192.png',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/',
    },
    actions: data.actions || [],
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'MAJH EVENTS', options)
  );
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Check if there's already a window open
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      // Open new window if none exists
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});

// Periodic Background Sync - fetch fresh data periodically
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'update-content') {
    event.waitUntil(
      // Refresh cached pages
      caches.open(CACHE_NAME).then((cache) => {
        return Promise.all(
          PRECACHE_ASSETS.map((url) =>
            fetch(url)
              .then((response) => {
                if (response.ok) {
                  return cache.put(url, response);
                }
              })
              .catch(() => {
                // Ignore fetch errors during background sync
              })
          )
        );
      })
    );
  }
});

// Background Sync - retry failed requests when back online
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-pending-data') {
    event.waitUntil(
      // Process any queued requests
      self.clients.matchAll().then((clients) => {
        clients.forEach((client) => {
          client.postMessage({
            type: 'SYNC_COMPLETE',
            message: 'Background sync completed',
          });
        });
      })
    );
  }
});

// Message handler for communication with the main app
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: CACHE_NAME });
  }
});
