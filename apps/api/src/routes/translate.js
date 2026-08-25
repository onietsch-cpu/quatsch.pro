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

export function validateTranslation(result, sourceText, targetLanguageCode) {
	const targetBase = baseLanguage(targetLanguageCode);
	const translatedBase = baseLanguage(result?.translatedLanguageCode);
	const sourceBase = baseLanguage(result?.detectedLanguageCode);
	const details = {
		expectedLanguageCode: targetBase || 'unspecified',
		reportedLanguageCode: translatedBase || 'unspecified',
		detectedLanguageCode: sourceBase || 'unspecified',
	};

	if (!result || typeof result.translation !== 'string' || !result.translation.trim()) {
		return { valid: false, reason: 'missing_translation', ...details };
	}
	if (targetBase && !translatedBase) {
		return { valid: false, reason: 'missing_translated_language', ...details };
	}
	if (targetBase && translatedBase !== targetBase) {
		return { valid: false, reason: 'target_language_mismatch', ...details };
	}

	const unchanged = normalizeComparableText(result.translation) === normalizeComparableText(sourceText);
	if (unchanged && isNumericOnlyText(sourceText)) {
		return { valid: false, reason: 'numeric_source_unchanged', ...details };
	}
	if (unchanged && targetBase && sourceBase !== targetBase) {
		return { valid: false, reason: 'source_copied', ...details };
	}
	return { valid: true, reason: 'valid', ...details };
}

export function isValidTranslation(result, sourceText, targetLanguageCode) {
	return validateTranslation(result, sourceText, targetLanguageCode).valid;
}

function correctionInstruction(reason) {
	switch (reason) {
		case 'missing_translation':
			return ' Return a complete, non-empty translation.';
		case 'missing_translated_language':
		case 'target_language_mismatch':
			return ' Use the requested target language and report its correct BCP-47 code.';
		case 'numeric_source_unchanged':
			return ' Spell out the complete numeric value in target-language words; do not return the original digits.';
		case 'source_copied':
			return ' Do not copy the source. Translate it into the requested target language.';
		default:
			return ' Correct the output language and return the required JSON.';
	}
}

async function requestTranslation({ text, targetLanguageName, targetLanguageCode, correctionReason = '' }) {
	const numericInstruction = isNumericOnlyText(text)
		? ' The source is numeric-only: spell out its complete value in target-language words; do not return the digits unchanged.'
		: '';
	const correctionPrompt = correctionReason
		? `\n\nThe previous answer was invalid.${correctionInstruction(correctionReason)}`
		: '';

	return generateJson({
		systemPrompt: SYSTEM_PROMPT,
		userPrompt: `Target: ${targetLanguageName} (${targetLanguageCode || 'locale unspecified'}).${numericInstruction}${correctionPrompt}\n\nSource:\n${text}`,
	});
}

function validationContext(req, validation) {
	return {
		requestId: req.requestId,
		validationReason: validation.reason,
		expectedLanguageCode: validation.expectedLanguageCode,
		reportedLanguageCode: validation.reportedLanguageCode,
		detectedLanguageCode: validation.detectedLanguageCode,
	};
}

export default async (req, res) => {
	const { text, targetLanguageName, targetLanguageCode, _hp } = req.body || {};

	if (_hp && String(_hp).trim()) {
		logger.warn('translate_honeypot_triggered', { requestId: req.requestId });
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
	let validation = validateTranslation(result, sourceText, targetLanguageCode);

	if (!validation.valid) {
		logger.warn('translate_invalid_output_retrying', validationContext(req, validation));
		result = await requestTranslation({
			text: sourceText,
			targetLanguageName,
			targetLanguageCode,
			correctionReason: validation.reason,
		});
		validation = validateTranslation(result, sourceText, targetLanguageCode);
	}

	if (!validation.valid) {
		logger.error('translate_invalid_output_after_retry', validationContext(req, validation));
		return res.status(502).json({ error: 'The translation service returned an invalid translation.' });
	}

	res.json({
		detectedLanguageName: result.detectedLanguageName || 'Unknown',
		detectedLanguageCode: result.detectedLanguageCode || '',
		translatedLanguageCode: result.translatedLanguageCode,
		translation: result.translation,
	});
};
