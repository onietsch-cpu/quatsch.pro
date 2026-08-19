// One-time recovery worker: remove stale CE Translator caches and registrations.
// Do not claim or navigate open clients here. Forced navigation during service
// worker activation can disrupt installed desktop app windows.

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

			await self.registration.unregister();
		})(),
	);
});
