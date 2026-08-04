// Module-level PWA install singleton.
// Attaching the `beforeinstallprompt` listener here (imported once, as early as
// possible from main.jsx) means the event is captured even if it fires before
// any React component that wants to show an install button has mounted yet.

let deferredEvent = null;
let isInstalled = false;
const listeners = new Set();

function notify() {
	listeners.forEach((fn) => {
		try {
			fn({ deferredEvent, isInstalled });
		} catch {
			/* noop */
		}
	});
}

if (typeof window !== 'undefined') {
	if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) {
		isInstalled = true;
	}
	if (window.navigator && window.navigator.standalone === true) {
		isInstalled = true;
	}

	window.addEventListener('beforeinstallprompt', (event) => {
		event.preventDefault();
		deferredEvent = event;
		notify();
	});

	window.addEventListener('appinstalled', () => {
		isInstalled = true;
		deferredEvent = null;
		notify();
	});
}

export function subscribe(fn) {
	listeners.add(fn);
	// Immediately hand the current state to the new subscriber.
	fn({ deferredEvent, isInstalled });
	return () => listeners.delete(fn);
}

export function getState() {
	return { deferredEvent, isInstalled };
}

export async function triggerInstall() {
	if (!deferredEvent) return false;
	deferredEvent.prompt();
	const { outcome } = await deferredEvent.userChoice;
	if (outcome === 'accepted') {
		isInstalled = true;
	}
	deferredEvent = null;
	notify();
	return outcome === 'accepted';
}
