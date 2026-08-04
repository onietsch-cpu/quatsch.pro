import React from 'react';
import ReactDOM from 'react-dom/client';
import App from '@/App';
import '@/index.css';
// Attach the beforeinstallprompt listener as early as possible so the event
// is never missed while the app finishes mounting.
import '@/lib/pwaInstall';

ReactDOM.createRoot(document.getElementById('root')).render(
	<App />
);

if ('serviceWorker' in navigator) {
	const registerSW = () =>
		navigator.serviceWorker.register('/sw.js').catch(() => {
			/* PWA offline shell is best-effort; app still works online without it */
		});
	// A registered service worker with a fetch handler is one of the browser's
	// installability checks — register immediately instead of waiting for the
	// window "load" event so the beforeinstallprompt criteria are met sooner.
	if (document.readyState === 'complete') {
		registerSW();
	} else {
		window.addEventListener('load', registerSW);
	}
}
