import { fetchWithRetry } from '@/lib/apiHealth';
import apiServerClient from '@/lib/apiServerClient';

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

/**
 * Performs one cancellable conversation turn without automatic HTTP retries.
 * The conversation state machine owns retry timing and stale-request handling.
 */
export async function translateConversation({
	text,
	sourceLanguageCode,
	targetLanguageCode,
	targetLanguageName,
	requestId,
	honeypot = '',
	signal,
} = {}) {
	if (typeof navigator !== 'undefined' && navigator.onLine === false) {
		const err = new Error('offline');
		err.code = 'offline';
		throw err;
	}

	let response;
	try {
		response = await apiServerClient.fetch('/translate', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'X-Requested-With': 'XMLHttpRequest',
				'X-Request-Id': requestId,
			},
			body: JSON.stringify({
				text,
				sourceLanguageCode,
				targetLanguageCode,
				targetLanguageName,
				requestId,
				_hp: String(honeypot ?? '').trim(),
			}),
			signal,
		});
	} catch (error) {
		if (error?.name === 'AbortError') {
			const err = new Error('aborted');
			err.code = 'aborted';
			throw err;
		}
		const err = new Error('network');
		err.code = 'network';
		throw err;
	}

	if (response.status === 502) {
		const err = new Error('The translation could not be produced in the target language.');
		err.code = 'invalid';
		err.status = response.status;
		throw err;
	}

	if (!response.ok) {
		const err = new Error('api');
		err.code = 'api';
		err.status = response.status;
		throw err;
	}

	return response.json();
}
