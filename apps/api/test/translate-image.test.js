import test from 'node:test';
import assert from 'node:assert/strict';
import translateImage from '../src/routes/translate-image.js';
import { generateJson } from '../src/services/ai-provider.js';

function mockProvider(t, content, finishReason = 'stop') {
	const oldFetch = global.fetch;
	const oldKey = process.env.OPENAI_API_KEY;
	process.env.OPENAI_API_KEY = 'test-placeholder';
	const requests = [];
	global.fetch = async (url, options) => {
		requests.push(JSON.parse(options.body));
		return Response.json({ choices: [{ finish_reason: finishReason, message: { content } }] });
	};
	t.after(() => {
		global.fetch = oldFetch;
		if (oldKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = oldKey;
	});
	return requests;
}
function request() {
	return { body: { image: 'aGVsbG8=', mimeType: 'image/png', targetLanguageName: 'German' } };
}

test('long screenshots get a generous output budget and retain every paragraph', async (t) => {
	const extractedText = Array.from({ length: 80 }, (_, i) => `Paragraph ${i}: This is a long screenshot with readable text.`).join('\n\n');
	const translation = Array.from({ length: 80 }, (_, i) => `Absatz ${i}: Dies ist ein langer Screenshot mit lesbarem Text.`).join('\n\n');
	const requests = mockProvider(t, JSON.stringify({ extractedText, translation, detectedLanguageName: 'English' }));
	let result;
	await translateImage(request(), { json(value) { result = value; } });
	assert.equal(requests[0].max_tokens, 16384);
	assert.equal(requests[0].messages[1].content[1].image_url.detail, 'high');
	assert.equal(result.extractedText, extractedText);
	assert.equal(result.translation, translation);
	assert.ok(result.translation.includes('Absatz 79'));
});

test('truncated but parseable provider output is not presented as complete', async (t) => {
	const requests = mockProvider(t, JSON.stringify({ extractedText: 'first paragraph', translation: 'erster Absatz' }), 'length');
	await assert.rejects(translateImage(request(), { json() { assert.fail('must not return partial output'); } }), { status: 422 });
	assert.equal(requests.length, 1);
});

test('OCR text without its translation is rejected', async (t) => {
	mockProvider(t, JSON.stringify({ extractedText: 'text', translation: '' }));
	await assert.rejects(translateImage(request(), { json() { assert.fail('must not return missing translation'); } }), { status: 502 });
});

test('image request gets 120 seconds even when the general timeout is shorter, without automatic retries', async (t) => {
	mockProvider(t, '{}');
	const oldTimeout = AbortSignal.timeout;
	const timeouts = []; let calls = 0;
	AbortSignal.timeout = (ms) => { timeouts.push(ms); return new AbortController().signal; };
	t.after(() => { AbortSignal.timeout = oldTimeout; });
	global.fetch = async () => { calls++; throw Object.assign(new Error('timeout'), { name: 'TimeoutError' }); };
	await assert.rejects(translateImage(request(), {}), { status: 503 });
	assert.deepEqual(timeouts, [120000]);
	assert.equal(calls, 1);
});

test('plain text callers keep their existing output budget', async (t) => {
	const requests = mockProvider(t, '{"translation":"Hallo"}');
	await generateJson({ systemPrompt: 'Translate', userPrompt: 'Hello' });
	assert.equal(requests[0].max_tokens, 300);
});
