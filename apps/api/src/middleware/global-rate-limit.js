import rateLimit from 'express-rate-limit';

export const globalRateLimit = rateLimit({
	windowMs: 60 * 60 * 1000,
	max: 10_000,
	standardHeaders: true,
	legacyHeaders: false,
	message: { error: 'Too many requests, please try again later' },
	validate: { trustProxy: false },
});
