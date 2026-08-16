import apiServerClient from '@/lib/apiServerClient';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Performs a fetch with automatic retries for transient failures
 * (network drop, cold-started backend, 429/5xx). Returns the Response.
 */
export async function fetchWithRetry(path, options = {}, { attempts = 3, baseDelay = 700 } = {}) {
	let lastError = null;

	for (let i = 0; i < attempts; i += 1) {
		try {
			const response = await apiServerClient.fetch(path, options);
			// Retry only on transient server-side conditions.
			if (response.status === 429 || response.status === 502 || response.status === 503 || response.status === 504) {
				lastError = Object.assign(new Error('api'), { code: 'api', status: response.status });
			} else {
				return response;
			}
		} catch {
			lastError = Object.assign(new Error('network'), { code: 'network' });
		}

		if (i < attempts - 1) {
			await sleep(baseDelay * Math.pow(2, i));
		}
	}

	throw lastError || Object.assign(new Error('network'), { code: 'network' });
}

/** Lightweight liveness probe used to warm up / verify the backend. */
export async function checkApiHealth() {
	try {
		const response = await apiServerClient.fetch('/health', { method: 'GET', cache: 'no-store' });
		return response.ok;
	} catch {
		return false;
	}
}
