import logger from '../utils/logger.js';
import { generateJson } from '../services/ai-provider.js';

const MAX_TEXT_LENGTH = 5000;

const SYSTEM_PROMPT = `You are a precise translation engine. Detect the source language and translate all source text into the requested target language. Return only JSON with this exact shape: {"detectedLanguageName":"English language name","detectedLanguageCode":"BCP-47 code","translation":"translated text"}. If the text is already in the target language, return it unchanged.`;

export default async (req, res) => {
	const { text, targetLanguageName, _hp } = req.body || {};
	const ip = req.ip || 'unknown';

	if (_hp && String(_hp).trim()) {
		logger.warn(`translate: honeypot triggered ip=${ip}`);
		return res.json({ detectedLanguageName: '', detectedLanguageCode: '', translation: '' });
	}
	if (!text || typeof text !== 'string' || !text.trim()) {
		return res.status(422).json({ error: 'Text is required.' });
	}
	if (text.length > MAX_TEXT_LENGTH) {
		return res.status(422).json({ error: `Text must not exceed ${MAX_TEXT_LENGTH} characters.` });
	}
	if (!targetLanguageName || typeof targetLanguageName !== 'string' || targetLanguageName.length > 100) {
		return res.status(422).json({ error: 'Target language is required.' });
	}

	const result = await generateJson({
		systemPrompt: SYSTEM_PROMPT,
		userPrompt: `Target language: ${targetLanguageName}\n\nSource text:\n${text.trim()}`,
	});
	if (!result.translation || typeof result.translation !== 'string') {
		throw new Error('Translation response did not contain translated text.');
	}

	res.json({
		detectedLanguageName: result.detectedLanguageName || 'Unknown',
		detectedLanguageCode: result.detectedLanguageCode || '',
		translation: result.translation,
	});
};
