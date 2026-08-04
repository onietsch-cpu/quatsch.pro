// CE Translator service worker – caches the app shell only.
// Translations always require network access and are never cached.

const CACHE_NAME = 'ce-translator-shell-v1';
const APP_SHELL = ['/', '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
	event.waitUntil(
		caches
			.open(CACHE_NAME)
			.then((cache) => cache.addAll(APP_SHELL))
			.catch(() => {})
			.then(() => self.skipWaiting()),
	);
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
			.then(() => self.clients.claim()),
	);
});

self.addEventListener('fetch', (event) => {
	const { request } = event;
	if (request.method !== 'GET') return;

	const url = new URL(request.url);

	// Never cache API / backend calls – translations need a live network.
	if (url.pathname.startsWith('/hcgi/') || url.pathname.startsWith('/api/')) {
		return;
	}

	// Navigation requests: try network first, fall back to cached shell offline.
	if (request.mode === 'navigate') {
		event.respondWith(
			fetch(request).catch(() => caches.match('/').then((res) => res || caches.match(request))),
		);
		return;
	}

	// Static assets: cache-first, then network, updating the cache in the background.
	event.respondWith(
		caches.match(request).then((cached) => {
			const networkFetch = fetch(request)
				.then((response) => {
					if (response && response.ok) {
						const clone = response.clone();
						caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
					}
					return response;
				})
				.catch(() => cached);
			return cached || networkFetch;
		}),
	);
});
