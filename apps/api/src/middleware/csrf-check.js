// Browser requests must come from this host or an explicitly configured origin.
// Custom headers alone never override a foreign Origin.
export function csrfCheck(req, res, next) {
	if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();
	const origin = req.headers.origin;
	const referer = req.headers.referer;
	const allowed = (process.env.CORS_ORIGIN || '').split(',').map((value) => value.trim()).filter(Boolean);
	if (origin || referer) {
		try {
			const source = new URL(origin || referer);
			if (['http:', 'https:'].includes(source.protocol) && (source.host === req.headers.host || allowed.includes(source.origin))) return next();
		} catch { /* Reject malformed origins. */ }
		return res.status(403).json({ error: 'Origin not allowed.' });
	}
	if (req.headers['x-requested-with'] === 'XMLHttpRequest') return next();
	return res.status(403).json({ error: 'Request verification required.' });
}
