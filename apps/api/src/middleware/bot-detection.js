import logger from '../utils/logger.js';

// Known bot/crawler user-agent fragments (lowercase)
const BOT_UA_PATTERNS = [
	'semrushbot', 'ahrefsbot', 'mj12bot', 'dotbot', 'rogerbot',
	'screaming frog', 'scrapy', 'mechanize',
];

// Suspicious request patterns
const SUSPICIOUS_PATHS = [
	/\/wp-admin/i, /\/wp-login/i, /\.php$/i, /\/xmlrpc/i,
	/\/\.env/i, /\/etc\/passwd/i, /\/proc\//i,
];

export function botDetection(req, res, next) {
	const ua = (req.headers['user-agent'] || '').toLowerCase();
	const ip = req.ip || req.connection?.remoteAddress || 'unknown';

	// Block suspicious path probes silently
	for (const pattern of SUSPICIOUS_PATHS) {
		if (pattern.test(req.path)) {
			logger.warn(`bot-detection: suspicious path probe ip=${ip} path=${req.path}`);
			return res.status(404).json({ error: 'Not found.' });
		}
	}

	// Detect known bots/scrapers
	for (const fragment of BOT_UA_PATTERNS) {
		if (ua.includes(fragment)) {
			logger.warn(`bot-detection: known scraper ua=${ua.slice(0, 80)} ip=${ip}`);
			return res.status(403).json({ error: 'Access denied.' });
		}
	}

	// Flag missing UA on POST endpoints (very unusual for real users)
	if (!ua && req.method === 'POST') {
		logger.warn(`bot-detection: missing user-agent on POST ip=${ip} path=${req.path}`);
		// Don't block — some legitimate clients omit UA — but log it
	}

	next();
}
