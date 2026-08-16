import { Router } from 'express';
import healthCheck from './health-check.js';
import translate from './translate.js';
import tts from './tts.js';
import translateImage from './translate-image.js';
import { botDetection } from '../middleware/bot-detection.js';
import { csrfCheck } from '../middleware/csrf-check.js';
import { translateRateLimit, translateImageRateLimit, hourlyRateLimit } from '../middleware/route-rate-limit.js';

export default () => {
	const router = Router();
	router.get('/health', healthCheck);

    // Apply bot detection and hourly cap to all API routes
	router.use(botDetection);
	router.use(hourlyRateLimit);

    // CSRF check on state-changing requests
	router.use(csrfCheck);

	router.post('/translate', translateRateLimit, translate);
	router.post('/tts', tts);
	router.get('/tts', tts);
	router.post('/translate-image', translateImageRateLimit, translateImage);

	return router;
};
