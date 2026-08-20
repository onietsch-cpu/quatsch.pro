import logger from '../utils/logger.js';
import { generateJson } from '../services/ai-provider.js';

const MAX_TEXT_LENGTH = 5000;

const SYSTEM_PROMPT = `You are a fast, precise translation engine. Translate the complete input naturally into the requested target language.

Rules:
1. Detect the source language automatically.
2. For an input made only of a number, write the number out fully in words in the target language. Never return only the original digits.
3. If non-numeric text is already in the target language, return it unchanged.
4. Report the language actually used in "translation" as "translatedLanguageCode".
5. Return only compact JSON with this exact shape: {"detectedLanguageName":"English language name","detectedLanguageCode":"BCP-47 code","translatedLanguageCode":"BCP-47 code","translation":"translated text"}.`;

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

export function isNumericOnlyText(value) {
	const text = String(value || '').trim();
	return /\p{N}/u.test(text) && /^[\p{N}\p{P}\p{S}\s]+$/u.test(text);
}

export function isValidTranslation(result, sourceText, targetLanguageCode) {
	if (!result || typeof result.translation !== 'string' || !result.translation.trim()) return false;

	const targetBase = baseLanguage(targetLanguageCode);
	const translatedBase = baseLanguage(result.translatedLanguageCode);
	if (targetBase && translatedBase !== targetBase) return false;

	const unchanged = normalizeComparableText(result.translation) === normalizeComparableText(sourceText);
	if (unchanged && isNumericOnlyText(sourceText)) return false;

	const sourceBase = baseLanguage(result.detectedLanguageCode);
	return !unchanged || !targetBase || sourceBase === targetBase;
}

async function requestTranslation({ text, targetLanguageName, targetLanguageCode, correction = false }) {
	const numericInstruction = isNumericOnlyText(text)
		? ' The source is numeric-only: spell out its complete value in target-language words; do not return the digits unchanged.'
		: '';
	const correctionPrompt = correction
		? '\n\nThe previous answer was invalid. Correct the output language and do not copy the source. For numeric-only input, return target-language number words.'
		: '';

	return generateJson({
		systemPrompt: SYSTEM_PROMPT,
		userPrompt: `Target: ${targetLanguageName} (${targetLanguageCode || 'locale unspecified'}).${numericInstruction}${correctionPrompt}\n\nSource:\n${text}`,
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
	if (targetLanguageCode !== undefined && (typeof targetLanguageCode !== 'string' || targetLanguageCode.length > 35)) {
		return res.status(422).json({ error: 'Target language code is invalid.' });
	}

	const sourceText = text.trim();
	let result = await requestTranslation({ text: sourceText, targetLanguageName, targetLanguageCode });

	if (!isValidTranslation(result, sourceText, targetLanguageCode)) {
		logger.warn(`translate: invalid output, retrying target="${targetLanguageCode || targetLanguageName}" ip=${ip}`);
		result = await requestTranslation({ text: sourceText, targetLanguageName, targetLanguageCode, correction: true });
	}

	if (!isValidTranslation(result, sourceText, targetLanguageCode)) {
		logger.error(`translate: invalid output after retry target="${targetLanguageCode || targetLanguageName}" ip=${ip}`);
		return res.status(502).json({ error: 'The translation service returned an invalid translation.' });
	}

	res.json({
		detectedLanguageName: result.detectedLanguageName || 'Unknown',
		detectedLanguageCode: result.detectedLanguageCode || '',
		translatedLanguageCode: result.translatedLanguageCode,
		translation: result.translation,
	});
};
