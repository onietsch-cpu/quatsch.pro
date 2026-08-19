import React from 'react';
import ReactDOM from 'react-dom/client';
import App from '@/App';
import '@/index.css';
import '@/lib/pwaInstall';

ReactDOM.createRoot(document.getElementById('root')).render(
	<App />
);

async function clearLegacyPwaState() {
	if ('serviceWorker' in navigator) {
		try {
			const registrations = await navigator.serviceWorker.getRegistrations();
			await Promise.all(registrations.map((registration) => registration.unregister()));
		} catch {
			/* Browser storage cleanup is best-effort. */
		}
	}

	if ('caches' in window) {
		try {
			const keys = await window.caches.keys();
			await Promise.all(
				keys
					.filter(
						(key) =>
							key.startsWith('ce-translator-shell-') ||
							key.startsWith('ce-translator-static-'),
					)
					.map((key) => window.caches.delete(key)),
			);
		} catch {
			/* Browser storage cleanup is best-effort. */
		}
	}
}

if (document.readyState === 'complete') {
	clearLegacyPwaState();
} else {
	window.addEventListener('load', clearLegacyPwaState, { once: true });
}
