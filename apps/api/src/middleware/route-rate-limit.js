import rateLimit from 'express-rate-limit';

const genericMessage = { error: 'Too many requests, please try again later.' };
const REQUESTS_PER_HOUR = 10_000;
const ONE_HOUR_MS = 60 * 60 * 1000;

/** 10,000 translation or transcription requests per hour per IP */
export const translateRateLimit = rateLimit({
	windowMs: ONE_HOUR_MS,
	max: REQUESTS_PER_HOUR,
	standardHeaders: true,
	legacyHeaders: false,
	message: genericMessage,
	validate: { trustProxy: false },
});

/** 30 photo-upload/translate-image requests per minute per IP */
export const translateImageRateLimit = rateLimit({
	windowMs: 60 * 1000,
	max: 30,
	standardHeaders: true,
	legacyHeaders: false,
	message: genericMessage,
	validate: { trustProxy: false },
});

/** 10,000 requests per hour per IP (broad hourly cap) */
export const hourlyRateLimit = rateLimit({
	windowMs: ONE_HOUR_MS,
	max: REQUESTS_PER_HOUR,
	standardHeaders: true,
	legacyHeaders: false,
	message: genericMessage,
	validate: { trustProxy: false },
});
