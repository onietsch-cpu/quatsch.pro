// CE Translator service worker - caches same-origin static assets only.
// HTML navigations and API requests always bypass the service worker.

const CACHE_NAME = 'ce-translator-static-v1';
const LEGACY_CACHE_PREFIX = 'ce-translator-shell-';
const STATIC_DESTINATIONS = new Set(['font', 'image', 'manifest', 'script', 'style']);

self.addEventListener('install', (event) => {
	event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		(async () => {
			const keys = await caches.keys();
			await Promise.all(
				keys
					.filter(
						(key) =>
							key.startsWith(LEGACY_CACHE_PREFIX) ||
							(key.startsWith('ce-translator-static-') && key !== CACHE_NAME),
					)
					.map((key) => caches.delete(key)),
			);
			await self.clients.claim();
		})(),
	);
});

self.addEventListener('fetch', (event) => {
	const { request } = event;

	if (
		request.method !== 'GET' ||
		request.mode === 'navigate' ||
		request.destination === 'document' ||
		request.headers.get('accept')?.includes('text/html')
	) {
		return;
	}

	const url = new URL(request.url);
	if (
		url.origin !== self.location.origin ||
		url.pathname.startsWith('/hcgi/') ||
		url.pathname.startsWith('/api/') ||
		!STATIC_DESTINATIONS.has(request.destination)
	) {
		return;
	}

	event.respondWith(
		(async () => {
			try {
				const response = await fetch(request);
				const contentType = response.headers.get('content-type') || '';

				if (response.ok && response.type === 'basic' && !contentType.includes('text/html')) {
					const cache = await caches.open(CACHE_NAME);
					await cache.put(request, response.clone());
				}

				return response;
			} catch (error) {
				const cached = await caches.match(request);
				if (cached) return cached;
				throw error;
			}
		})(),
	);
});
