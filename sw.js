// Joheliv Labs - StudyPad Document Study Tool - sw.js
// Version: v2 - Optimized for GitHub Pages subpath

const CACHE_NAME = 'studypad-doc-tool-v2';
const BASE_PATH = '/studypad-documentstudytool/';

const FILES_TO_CACHE = [
  `${BASE_PATH}`,
  `${BASE_PATH}index.html`,
  `${BASE_PATH}manifest.json`,
  `${BASE_PATH}icon-512.png`,
  `${BASE_PATH}icon-192.png`,
  // Add your css/js if you have them
  // `${BASE_PATH}styles.css`,
  // `${BASE_PATH}app.js`
];

// Install - Cache app shell
self.addEventListener('install', (e) => {
  console.log('[StudyPad] Installing SW');
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(FILES_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// Activate - Clean old caches
self.addEventListener('activate', (e) => {
  console.log('[StudyPad] Activating SW');
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      );
    })
  );
  self.clients.claim();
});

// Fetch - Cache First, then Network (best for your study tool)
self.addEventListener('fetch', (e) => {
  // Skip non-GET and chrome extensions
  if (e.request.method !== 'GET' || !e.request.url.startsWith('http')) return;

  e.respondWith(
    caches.match(e.request).then((cached) => {
      if (cached) return cached;

      return fetch(e.request).then((response) => {
        // Cache new files dynamically (pdfs, docs)
        if (response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(e.request, clone);
          });
        }
        return response;
      }).catch(() => {
        // Offline fallback
        if (e.request.headers.get('accept').includes('text/html')) {
          return caches.match(`${BASE_PATH}index.html`);
        }
      });
    })
  );
});
