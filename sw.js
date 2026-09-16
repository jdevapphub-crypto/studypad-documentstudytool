/* =====================================================
   StudyPad — Service Worker
   Joheliv: Jason's Labs, South Africa, 2026
===================================================== */

const CACHE_NAME = 'studypad-cache-v1';
const RUNTIME_CACHE = 'studypad-runtime-v1';

/* =====================================================
   ASSETS TO PRECACHE
   Adjust paths if your folder structure differs.
===================================================== */
const PRECACHE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  // External CDN libraries (cached on first load)
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js',
  'https://cdn.jsdelivr.net/npm/idb@7/build/umd.js'
];

/* =====================================================
   INSTALL EVENT
   Pre-cache the app shell.
===================================================== */
self.addEventListener('install', (event) => {
  console.log('[StudyPad SW] Installing...');

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(PRECACHE_ASSETS).catch((err) => {
          console.warn('[StudyPad SW] Some assets failed to precache:', err);
        });
      })
      .then(() => self.skipWaiting())
  );
});

/* =====================================================
   ACTIVATE EVENT
   Clean up old caches.
===================================================== */
self.addEventListener('activate', (event) => {
  console.log('[StudyPad SW] Activating...');

  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME && name !== RUNTIME_CACHE)
          .map((name) => {
            console.log('[StudyPad SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    }).then(() => self.clients.claim())
  );
});

/* =====================================================
   FETCH EVENT
   Strategy:
     - API calls (Worker) → network first, no cache
     - Navigation → network first, fallback to cache
     - Static assets → cache first, fallback to network
===================================================== */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  /* -------- Skip non-GET requests -------- */
  if (request.method !== 'GET') return;

  /* -------- Skip chrome-extension and other schemes -------- */
  if (!url.protocol.startsWith('http')) return;

  /* -------- API calls: Network only (never cache AI responses) -------- */
  if (url.hostname.includes('workers.dev') || 
      url.href.includes('aidetector.jdevapphub')) {
    event.respondWith(
      fetch(request).catch(() => {
        return new Response(
          JSON.stringify({ 
            error: 'offline', 
            message: 'You are offline. Please check your internet connection.' 
          }),
          {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      })
    );
    return;
  }

  /* -------- Navigation requests: network first -------- */
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(RUNTIME_CACHE).then((cache) => {
            cache.put(request, copy);
          });
          return response;
        })
        .catch(() => {
          return caches.match(request)
            .then((cached) => cached || caches.match('./index.html'));
        })
    );
    return;
  }

  /* -------- Static assets: cache first -------- */
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;

      return fetch(request)
        .then((response) => {
          // Only cache successful, basic/cors responses
          if (!response || response.status !== 200 || response.type === 'error') {
            return response;
          }

          const copy = response.clone();
          caches.open(RUNTIME_CACHE).then((cache) => {
            cache.put(request, copy).catch(() => {});
          });

          return response;
        })
        .catch(() => {
          // Fallback for failed asset requests
          if (request.destination === 'document') {
            return caches.match('./index.html');
          }
          return new Response('', { status: 408 });
        });
    })
  );
});

/* =====================================================
   MESSAGE EVENT
   Allows the page to trigger skipWaiting.
===================================================== */
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

/* =====================================================
   BACKGROUND SYNC (placeholder for future use)
===================================================== */
self.addEventListener('sync', (event) => {
  if (event.tag === 'studypad-sync') {
    console.log('[StudyPad SW] Background sync triggered');
    // Future: sync offline study kits to a server
  }
});

/* =====================================================
   PUSH NOTIFICATIONS (placeholder for future use)
===================================================== */
self.addEventListener('push', (event) => {
  if (!event.data) return;

  const data = event.data.json();
  const options = {
    body: data.body || 'New update from StudyPad',
    icon: './icon-192.png',
    badge: './icon-192.png',
    vibrate: [100, 50, 100],
    data: { url: data.url || '/' }
  };

  event.waitUntil(
    self.registration.showNotification(
      data.title || 'StudyPad',
      options
    )
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data.url || '/')
  );
});
