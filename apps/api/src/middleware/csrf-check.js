import logger from '../utils/logger.js';

/**
 * Lightweight CSRF protection for JSON API endpoints.
 * Requires the custom header `X-Requested-With: XMLHttpRequest` on all
 * state-changing requests (POST/PUT/PATCH/DELETE). Browsers never include
 * this header in cross-site form submissions or simple requests, making it
 * an effective CSRF barrier without token round-trips.
 *
 * Additionally checks Origin/Referer to catch non-browser HTTP clients
 * that might strip the custom header.
 */
export function csrfCheck(req, res, next) {
	// Only apply to state-changing methods
	if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
		return next();
	}

	const requestedWith = req.headers['x-requested-with'];
	const origin = req.headers['origin'];
	const referer = req.headers['referer'];
	const host = req.headers['host'] || '';
	const ip = req.ip || 'unknown';

	// Allow if the custom header is present (set by apiServerClient)
	if (requestedWith === 'XMLHttpRequest') {
		return next();
	}

	// Allow if Origin matches the host (same-origin browser request)
	if (origin) {
		try {
			const originHost = new URL(origin).host;
			// Accept same-host or localhost for dev
			if (originHost === host || originHost.startsWith('localhost') || originHost.startsWith('127.0.0.1')) {
				return next();
			}
		} catch {
			// malformed origin — fall through to block
		}
		logger.warn(`csrf-check: origin mismatch origin=${origin} host=${host} ip=${ip}`);
		return res.status(403).json({ error: 'Origin not allowed.' });
	}

	// Allow if Referer matches host (browser fallback when Origin is absent)
	if (referer) {
		try {
			const refHost = new URL(referer).host;
			if (refHost === host || refHost.startsWith('localhost') || refHost.startsWith('127.0.0.1')) {
				return next();
			}
		} catch {
			// malformed referer
		}
		logger.warn(`csrf-check: referer mismatch referer=${referer} host=${host} ip=${ip}`);
		return res.status(403).json({ error: 'Referer not allowed.' });
	}

	// No Origin, no Referer, no custom header — likely a scripted/direct request
	// Log but allow: mobile apps and some browsers omit these headers legitimately
	logger.warn(`csrf-check: no origin/referer/custom-header on POST ip=${ip} path=${req.path} ua=${(req.headers['user-agent'] || '').slice(0, 60)}`);
	next();
}
