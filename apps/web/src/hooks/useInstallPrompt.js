import { useEffect, useState, useCallback } from 'react';
import { subscribe, triggerInstall } from '@/lib/pwaInstall';

function detectOS() {
	if (typeof navigator === 'undefined') return 'other';
	const ua = navigator.userAgent || '';
	if (/android/i.test(ua)) return 'android';
	if (/iphone|ipad|ipod/i.test(ua)) return 'ios';
	if (/mac/i.test(ua)) return 'mac';
	if (/win/i.test(ua)) return 'windows';
	return 'other';
}

function detectBrowser() {
	if (typeof navigator === 'undefined') return 'other';
	const ua = navigator.userAgent || '';
	if (/edg\//i.test(ua)) return 'edge';
	if (/chrome|chromium|crios/i.test(ua) && !/edg\//i.test(ua)) return 'chrome';
	if (/firefox|fxios/i.test(ua)) return 'firefox';
	if (/safari/i.test(ua) && !/chrome|chromium|crios|edg\//i.test(ua)) return 'safari';
	return 'other';
}

// Tracks the beforeinstallprompt event (via the module-level pwaInstall
// singleton, so it is caught even if it fired before this hook mounted) and
// exposes OS/browser-specific manual instructions as a fallback for engines
// that never emit that event (Safari on iOS and macOS, Firefox).
export function useInstallPrompt() {
	const [state, setState] = useState({ deferredEvent: null, isInstalled: false });
	const os = detectOS();
	const browser = detectBrowser();

	useEffect(() => {
		return subscribe(setState);
	}, []);

	const promptInstall = useCallback(async () => {
		return triggerInstall();
	}, []);

	// Only Chromium-based browsers (Chrome, Edge, and most Android browsers)
	// ever fire beforeinstallprompt. Everyone else needs manual steps.
	const supportsAutoPrompt = browser === 'chrome' || browser === 'edge';

	const instructions = {
		android: 'Open the browser menu (⋮) and tap "Install app" or "Add to Home screen".',
		windows: 'Click the install icon (⊕) at the right of the address bar, or open the browser menu → "Install CE Translator".',
		mac:
			browser === 'safari'
				? 'In Safari\'s menu bar choose File → "Add to Dock" (Safari 17+), or use the Share button → "Add to Dock".'
				: 'Click the install icon at the right of the address bar, or open the browser menu → "Install CE Translator".',
		ios: 'Tap the Share button, then choose "Add to Home Screen".',
		other: 'Look in the browser menu for an option to install or add this app to your home screen.',
	}[os];

	return {
		canPrompt: Boolean(state.deferredEvent),
		isInstalled: state.isInstalled,
		promptInstall,
		os,
		browser,
		supportsAutoPrompt,
		instructions,
	};
}
