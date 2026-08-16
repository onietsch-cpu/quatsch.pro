import assert from 'node:assert/strict';
import test from 'node:test';
import { getProviderConfig, parseJsonContent } from '../src/services/ai-provider.js';

test('parseJsonContent accepts plain and fenced JSON', () => {
	assert.deepEqual(parseJsonContent('{"translation":"Hallo"}'), { translation: 'Hallo' });
	assert.deepEqual(parseJsonContent('```json\n{"translation":"Hello"}\n```'), { translation: 'Hello' });
});

test('provider base URL is normalized', () => {
	const previous = process.env.OPENAI_API_BASE_URL;
	process.env.OPENAI_API_BASE_URL = 'https://example.test/v1/chat/completions/';
	assert.equal(getProviderConfig().apiBaseUrl, 'https://example.test/v1');
	if (previous === undefined) delete process.env.OPENAI_API_BASE_URL;
	else process.env.OPENAI_API_BASE_URL = previous;
});
