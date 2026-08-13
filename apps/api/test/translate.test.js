import assert from 'node:assert/strict';
import test from 'node:test';
import { isValidTranslation } from '../src/routes/translate.js';

test('accepts a translation reported in the requested language', () => {
	assert.equal(isValidTranslation({
		detectedLanguageCode: 'de',
		translatedLanguageCode: 'en-US',
		translation: 'Good morning',
	}, 'Guten Morgen', 'en'), true);
});

test('rejects a translation reported in another language', () => {
	assert.equal(isValidTranslation({
		detectedLanguageCode: 'de',
		translatedLanguageCode: 'de',
		translation: 'Guten Morgen',
	}, 'Guten Morgen', 'en'), false);
});

test('rejects copied source text when source and target languages differ', () => {
	assert.equal(isValidTranslation({
		detectedLanguageCode: 'de-DE',
		translatedLanguageCode: 'en',
		translation: 'GUTEN, Morgen!',
	}, 'Guten Morgen', 'en-US'), false);
});

test('accepts unchanged text when it is already in the target language', () => {
	assert.equal(isValidTranslation({
		detectedLanguageCode: 'en-GB',
		translatedLanguageCode: 'en-US',
		translation: 'Good morning',
	}, 'Good morning', 'en'), true);
});

test('rejects missing translation metadata', () => {
	assert.equal(isValidTranslation({ translation: 'Good morning' }, 'Guten Morgen', 'en'), false);
});

test('keeps legacy clients without a target code compatible', () => {
	assert.equal(isValidTranslation({ translation: 'Good morning' }, 'Guten Morgen'), true);
});
