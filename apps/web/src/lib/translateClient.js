import { fetchWithRetry } from '@/lib/apiHealth';

export async function translateText({ text, targetLanguageName, targetLanguageCode, honeypot = '' }) {
	if (typeof navigator !== 'undefined' && navigator.onLine === false) {
		const err = new Error('offline');
		err.code = 'offline';
		throw err;
	}

	const response = await fetchWithRetry('/translate', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'X-Requested-With': 'XMLHttpRequest',
		},
		body: JSON.stringify({ text, targetLanguageName, targetLanguageCode, _hp: honeypot }),
	});

	if (!response.ok) {
		const err = new Error('api');
		err.code = 'api';
		throw err;
	}

	return response.json();
}
