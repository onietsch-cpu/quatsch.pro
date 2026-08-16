import logger from '../utils/logger.js';
import { generateJson } from '../services/ai-provider.js';

const MAX_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const SYSTEM_PROMPT = `You are an OCR and translation engine. Extract all visible text from the supplied image, preserving sensible line breaks, and translate it into the requested target language. Return only JSON with this exact shape: {"extractedText":"all visible text","translation":"translated text","detectedLanguageName":"English language name"}. If there is no text, return empty strings for extractedText and translation.`;

export default async (req, res) => {
	const { image, mimeType, targetLanguageName, _hp } = req.body || {};

	if (_hp && String(_hp).trim()) {
		logger.warn('translate-image: honeypot triggered');
		return res.json({ extractedText: '', translation: '', detectedLanguageName: '' });
	}
	if (!image || typeof image !== 'string') {
		return res.status(422).json({ error: 'image (base64) is required' });
	}
	if (!/^[A-Za-z0-9+/]+={0,2}$/.test(image)) {
		return res.status(422).json({ error: 'image must be valid base64' });
	}
	if (!ALLOWED_TYPES.has(mimeType)) {
		return res.status(422).json({ error: 'mimeType must be image/jpeg, image/png, or image/webp' });
	}
	if (!targetLanguageName || typeof targetLanguageName !== 'string' || targetLanguageName.length > 100) {
		return res.status(422).json({ error: 'targetLanguageName is required' });
	}

	let imageBuffer;
	try {
		imageBuffer = Buffer.from(image, 'base64');
	} catch {
		return res.status(422).json({ error: 'image must be valid base64' });
	}
	if (!imageBuffer.length || imageBuffer.length > MAX_SIZE_BYTES) {
		return res.status(422).json({ error: 'Image must be between 1 byte and 5 MB' });
	}

	const result = await generateJson({
		systemPrompt: SYSTEM_PROMPT,
		userPrompt: `Target language: ${targetLanguageName}`,
		imageDataUrl: `data:${mimeType};base64,${image}`,
	});

	res.json({
		extractedText: typeof result.extractedText === 'string' ? result.extractedText : '',
		translation: typeof result.translation === 'string' ? result.translation : '',
		detectedLanguageName: result.detectedLanguageName || 'Unknown',
	});
};
