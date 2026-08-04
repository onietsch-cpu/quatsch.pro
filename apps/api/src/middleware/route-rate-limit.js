import rateLimit from 'express-rate-limit';

const genericMessage = { error: 'Too many requests, please try again later.' };

/** 10 translation requests per minute per IP */
export const translateRateLimit = rateLimit({
	windowMs: 60 * 1000,
	max: 60,
	standardHeaders: true,
	legacyHeaders: false,
	message: genericMessage,
	validate: { trustProxy: false },
});

/** 5 photo-upload/translate-image requests per minute per IP */
export const translateImageRateLimit = rateLimit({
	windowMs: 60 * 1000,
	max: 30,
	standardHeaders: true,
	legacyHeaders: false,
	message: genericMessage,
	validate: { trustProxy: false },
});

/** 100 requests per hour per IP (broad hourly cap) */
export const hourlyRateLimit = rateLimit({
	windowMs: 60 * 60 * 1000,
	max: 1000,
	standardHeaders: true,
	legacyHeaders: false,
	message: genericMessage,
	validate: { trustProxy: false },
});
