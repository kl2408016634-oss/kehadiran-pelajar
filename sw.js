// Service Worker - Sistem Kehadiran Pelajar
// Hanya cache fail senarai di bawah — elak cache “semua URL” (boleh serabut dengan projek lain pada origin yang sama).
const CACHE_NAME = 'kehadiran-v8';
const ASSETS = [
    './',
    './index.html',
    './style.css',
    './app.js',
    './firebase-config.js',
    './manifest.json'
];

const ALLOWED_FILES = new Set([
    'index.html',
    'style.css',
    'app.js',
    'firebase-config.js',
    'manifest.json',
    'sw.js'
]);

function pathEndsWithAllowedFile(pathname) {
    const seg = pathname.split('/').filter(Boolean);
    const last = seg[seg.length - 1] || 'index.html';
    return ALLOWED_FILES.has(last);
}

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
    );
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(
                keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
            )
        )
    );
    self.clients.claim();
});

self.addEventListener('fetch', event => {
    const req = event.request;
    if (req.method !== 'GET') return;

    const url = new URL(req.url);
    if (url.origin !== self.location.origin) return;

    // Halaman utama: rangkaian dulu; offline baru fallback ke index kehadiran
    if (req.mode === 'navigate') {
        event.respondWith(
            fetch(req).catch(() => caches.match('./index.html'))
        );
        return;
    }

    if (!pathEndsWithAllowedFile(url.pathname)) {
        return;
    }

    event.respondWith(
        caches.match(req).then(cached => {
            if (cached) return cached;
            return fetch(req).then(response => {
                if (response.ok) {
                    const copy = response.clone();
                    caches.open(CACHE_NAME).then(c => c.put(req, copy));
                }
                return response;
            });
        })
    );
});
