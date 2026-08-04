import apiServerClient from '@/lib/apiServerClient';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Lightweight liveness probe used to warm up / verify the backend. */
export async function checkApiHealth() {
	try {
		const response = await apiServerClient.fetch('/health', { method: 'GET', cache: 'no-store' });
		return response.ok;
	} catch {
		return false;
	}
}

/**
 * The sandbox backend hibernates when idle and needs a few seconds to boot on
 * the first request. This polls /health until the server answers (or timeout).
 */
export async function wakeBackend({ timeoutMs = 45000, intervalMs = 1500 } = {}) {
	const deadline = Date.now() + timeoutMs;
	// eslint-disable-next-line no-constant-condition
	while (true) {
		if (await checkApiHealth()) return true;
		if (Date.now() >= deadline) return false;
		await sleep(intervalMs);
	}
}

/**
 * Performs a fetch with automatic retries for transient failures
 * (network drop, cold-started backend, 429/5xx). Returns the Response.
 */
export async function fetchWithRetry(path, options = {}, { attempts = 5, baseDelay = 800 } = {}) {
	let lastError = null;

	for (let i = 0; i < attempts; i += 1) {
		try {
			const response = await apiServerClient.fetch(path, options);
			if (response.status === 429 || response.status >= 500) {
				lastError = Object.assign(new Error('api'), { code: 'api', status: response.status });
			} else {
				return response;
			}
		} catch {
			lastError = Object.assign(new Error('network'), { code: 'network' });
			// Most likely a hibernating backend — wait for it to come up.
			await wakeBackend({ timeoutMs: 20000 });
		}

		if (i < attempts - 1) {
			await sleep(Math.min(baseDelay * Math.pow(2, i), 5000));
		}
	}

	throw lastError || Object.assign(new Error('network'), { code: 'network' });
}
