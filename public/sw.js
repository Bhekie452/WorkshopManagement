const STATIC_CACHE = 'autoflow-static-v3';
const API_CACHE = 'autoflow-api-v3';
const urlsToCache = [
    '/',
    '/index.html',
    '/offline.html',
    '/manifest.json'
];

const SYNC_TAG = 'wms-sync';

const isAssetRequest = (request, url) => {
    if (request.destination && ['script', 'style', 'image', 'font'].includes(request.destination)) {
        return true;
    }
    return /\.(js|css|png|jpg|jpeg|svg|gif|webp|woff|woff2)$/i.test(url.pathname);
};

const isApiRequest = (url) => {
    return url.pathname.startsWith('/api/') ||
        (url.hostname === 'localhost' && url.port === '3001');
};

// Install event - cache static assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then((cache) => {
                console.log('Opened cache');
                return cache.addAll(urlsToCache);
            })
    );
    self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== STATIC_CACHE && cacheName !== API_CACHE) {
                        console.log('Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// Fetch event
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    if (request.method !== 'GET') {
        return;
    }

    // For HTML requests (navigation), try Network First, then Cache
    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request)
                .catch(() => {
                    return caches.match(request)
                        .then((response) => {
                            if (response) return response;
                            return caches.match('/offline.html');
                        });
                })
        );
        return;
    }

    // API strategy: Network First, Cache Fallback
    if (isApiRequest(url)) {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    if (response && response.ok) {
                        const responseClone = response.clone();
                        event.waitUntil(
                            caches.open(API_CACHE).then((cache) => cache.put(request, responseClone))
                        );
                    }
                    return response;
                })
                .catch(async () => {
                    const cached = await caches.match(request);
                    if (cached) return cached;
                    return new Response(JSON.stringify({ error: 'Offline and no cached API response' }), {
                        status: 503,
                        headers: { 'Content-Type': 'application/json' }
                    });
                })
        );
        return;
    }

    // Assets strategy: Cache First + Background Update
    if (isAssetRequest(request, url)) {
        event.respondWith(
            caches.match(request).then((cached) => {
                const networkUpdate = fetch(request)
                    .then((networkResponse) => {
                        if (networkResponse && networkResponse.status === 200) {
                            const cloned = networkResponse.clone();
                            event.waitUntil(
                                caches.open(STATIC_CACHE).then((cache) => cache.put(request, cloned))
                            );
                        }
                        return networkResponse;
                    })
                    .catch(() => cached);

                return cached || networkUpdate;
            })
        );
        return;
    }

    // Default strategy: stale-while-revalidate style behavior
    event.respondWith(
        caches.match(request)
            .then((response) => {
                const networkPromise = fetch(request).then((networkResponse) => {
                    if (networkResponse && networkResponse.status === 200) {
                        const responseToCache = networkResponse.clone();
                        event.waitUntil(
                            caches.open(STATIC_CACHE).then((cache) => {
                                cache.put(request, responseToCache);
                            })
                        );
                    }
                    return networkResponse;
                });

                if (response) {
                    event.waitUntil(networkPromise.catch(() => undefined));
                    return response;
                }

                return networkPromise.catch(() => {
                    if (request.destination === 'document') {
                        return caches.match('/offline.html');
                    }
                    return new Response('Offline', { status: 503 });
                });
            })
    );
});

// Background sync event (asks client pages to process IndexedDB queue)
self.addEventListener('sync', (event) => {
    if (event.tag === SYNC_TAG) {
        event.waitUntil(
            self.clients.matchAll({ includeUncontrolled: true, type: 'window' })
                .then((clients) => {
                    clients.forEach((client) => {
                        client.postMessage({ type: 'PROCESS_OFFLINE_QUEUE' });
                    });
                })
        );
    }
});

self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
