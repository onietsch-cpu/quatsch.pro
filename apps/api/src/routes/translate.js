import logger from '../utils/logger.js';
import { generateJson } from '../services/ai-provider.js';

const MAX_TEXT_LENGTH = 5000;

const SYSTEM_PROMPT = `You are a precise, professional translation engine. Your only job is to translate text into the requested target language.

Rules:
1. Detect the source language automatically.
2. Translate the entire source text faithfully and naturally into the requested target language.
3. The "translation" field must be written in the requested target language, never another language.
4. If the source text is already in the target language, return it unchanged.
5. Report the language actually used in "translation" as "translatedLanguageCode".
6. Return only compact JSON with this exact shape: {"detectedLanguageName":"English language name","detectedLanguageCode":"BCP-47 code","translatedLanguageCode":"BCP-47 code","translation":"translated text"}.`;

function baseLanguage(code) {
	return String(code || '').trim().toLowerCase().split(/[-_]/)[0];
}

function normalizeComparableText(value) {
	return String(value || '')
		.normalize('NFKC')
		.toLocaleLowerCase()
		.replace(/[\p{P}\p{S}\s]+/gu, ' ')
		.trim();
}

export function isValidTranslation(result, sourceText, targetLanguageCode) {
	if (!result || typeof result.translation !== 'string' || !result.translation.trim()) return false;

	const targetBase = baseLanguage(targetLanguageCode);
	const translatedBase = baseLanguage(result.translatedLanguageCode);
	if (!targetBase || translatedBase !== targetBase) return false;

	const sourceBase = baseLanguage(result.detectedLanguageCode);
	const unchanged = normalizeComparableText(result.translation) === normalizeComparableText(sourceText);
	return !unchanged || sourceBase === targetBase;
}

async function requestTranslation({ text, targetLanguageName, targetLanguageCode, correction = false }) {
	const correctionPrompt = correction
		? '\n\nYour previous answer was invalid because it copied the source or used the wrong output language. Translate it again, verify the actual output language, and return the required JSON.'
		: '';

	return generateJson({
		systemPrompt: SYSTEM_PROMPT,
		userPrompt: `Target language: ${targetLanguageName} (${targetLanguageCode}). The "translation" field must be entirely in that language, and "translatedLanguageCode" must identify the language actually used.${correctionPrompt}\n\nSource text:\n${text}`,
	});
}

export default async (req, res) => {
	const { text, targetLanguageName, targetLanguageCode, _hp } = req.body || {};
	const ip = req.ip || 'unknown';

	if (_hp && String(_hp).trim()) {
		logger.warn(`translate: honeypot triggered ip=${ip}`);
		return res.json({ detectedLanguageName: '', detectedLanguageCode: '', translatedLanguageCode: '', translation: '' });
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
	if (!targetLanguageCode || typeof targetLanguageCode !== 'string' || targetLanguageCode.length > 35) {
		return res.status(422).json({ error: 'Target language code is required.' });
	}

	const sourceText = text.trim();
	let result = await requestTranslation({ text: sourceText, targetLanguageName, targetLanguageCode });

	if (!isValidTranslation(result, sourceText, targetLanguageCode)) {
		logger.warn(`translate: invalid output, retrying target="${targetLanguageCode}" ip=${ip}`);
		result = await requestTranslation({
			text: sourceText,
			targetLanguageName,
			targetLanguageCode,
			correction: true,
		});
	}

	if (!isValidTranslation(result, sourceText, targetLanguageCode)) {
		logger.error(`translate: invalid output after retry target="${targetLanguageCode}" ip=${ip}`);
		return res.status(502).json({ error: 'The translation service returned an invalid translation.' });
	}

	res.json({
		detectedLanguageName: result.detectedLanguageName || 'Unknown',
		detectedLanguageCode: result.detectedLanguageCode || '',
		translatedLanguageCode: result.translatedLanguageCode,
		translation: result.translation,
	});
};
