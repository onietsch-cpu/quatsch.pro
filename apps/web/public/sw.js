// One-time recovery worker: remove stale CE Translator caches and registrations.
// The app requires a network connection for translations, so normal browser
// caching is preferable while affected clients recover from legacy PWA state.

const CACHE_PREFIXES = ['ce-translator-shell-', 'ce-translator-static-'];

self.addEventListener('install', (event) => {
	event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		(async () => {
			const keys = await caches.keys();
			await Promise.all(
				keys
					.filter((key) => CACHE_PREFIXES.some((prefix) => key.startsWith(prefix)))
					.map((key) => caches.delete(key)),
			);

			await self.clients.claim();
			await self.registration.unregister();

			const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
			await Promise.all(
				windows.map((client) => client.navigate(client.url).catch(() => undefined)),
			);
		})(),
	);
});
