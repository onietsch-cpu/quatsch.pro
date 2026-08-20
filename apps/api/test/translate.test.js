import assert from 'node:assert/strict';
import test from 'node:test';
import { isNumericOnlyText, isValidTranslation } from '../src/routes/translate.js';

test('accepts a translation reported in the requested language', () => {
	assert.equal(isValidTranslation({ detectedLanguageCode: 'de', translatedLanguageCode: 'en-US', translation: 'Good morning' }, 'Guten Morgen', 'en'), true);
});

test('rejects a translation reported in another language', () => {
	assert.equal(isValidTranslation({ detectedLanguageCode: 'de', translatedLanguageCode: 'de', translation: 'Guten Morgen' }, 'Guten Morgen', 'en'), false);
});

test('rejects copied source text when source and target languages differ', () => {
	assert.equal(isValidTranslation({ detectedLanguageCode: 'de-DE', translatedLanguageCode: 'en', translation: 'GUTEN, Morgen!' }, 'Guten Morgen', 'en-US'), false);
});

test('accepts unchanged text when it is already in the target language', () => {
	assert.equal(isValidTranslation({ detectedLanguageCode: 'en-GB', translatedLanguageCode: 'en-US', translation: 'Good morning' }, 'Good morning', 'en'), true);
});

test('rejects missing translation metadata', () => {
	assert.equal(isValidTranslation({ translation: 'Good morning' }, 'Guten Morgen', 'en'), false);
});

test('keeps legacy clients without a target code compatible', () => {
	assert.equal(isValidTranslation({ translation: 'Good morning' }, 'Guten Morgen'), true);
});

test('detects numeric-only input including formatted values', () => {
	assert.equal(isNumericOnlyText('1'), true);
	assert.equal(isNumericOnlyText('23 000'), true);
	assert.equal(isNumericOnlyText('-12.5'), true);
	assert.equal(isNumericOnlyText('23,000 Euro'), false);
});

test('requires numeric-only input to be written as words', () => {
	assert.equal(isValidTranslation({ detectedLanguageCode: 'und', translatedLanguageCode: 'de', translation: '2' }, '2', 'de'), false);
	assert.equal(isValidTranslation({ detectedLanguageCode: 'und', translatedLanguageCode: 'de', translation: 'zwei' }, '2', 'de'), true);
});
