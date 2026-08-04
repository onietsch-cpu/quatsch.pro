// Local persistence helpers for settings, translation history and privacy notice.
// Nothing here ever leaves the device – it is plain localStorage.

const SETTINGS_KEY = 'ce_translator_settings_v1';
const HISTORY_KEY = 'ce_translator_history_v1';
const PRIVACY_KEY = 'ce_translator_privacy_ack_v1';
const MAX_HISTORY = 20;

export const DEFAULT_SETTINGS = {
	autoRead: true,
	rate: 1,
	preferredTargetCode: 'en-US',
	theme: 'system', // 'light' | 'dark' | 'system'
	saveHistory: true,
};

export function getSettings() {
	try {
		const raw = JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null');
		if (!raw || typeof raw !== 'object') return { ...DEFAULT_SETTINGS };
		return { ...DEFAULT_SETTINGS, ...raw };
	} catch {
		return { ...DEFAULT_SETTINGS };
	}
}

export function saveSettings(next) {
	try {
		localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
	} catch {
		/* noop */
	}
}

export function getHistory() {
	try {
		const raw = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
		return Array.isArray(raw) ? raw : [];
	} catch {
		return [];
	}
}

export function addHistoryEntry(entry) {
	try {
		const current = getHistory();
		const next = [{ ...entry, id: entry.id || Date.now() + Math.random(), at: Date.now() }, ...current].slice(
			0,
			MAX_HISTORY,
		);
		localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
		return next;
	} catch {
		return getHistory();
	}
}

export function clearHistory() {
	try {
		localStorage.removeItem(HISTORY_KEY);
	} catch {
		/* noop */
	}
}

export function hasAckedPrivacy() {
	try {
		return localStorage.getItem(PRIVACY_KEY) === '1';
	} catch {
		return false;
	}
}

export function ackPrivacy() {
	try {
		localStorage.setItem(PRIVACY_KEY, '1');
	} catch {
		/* noop */
	}
}
