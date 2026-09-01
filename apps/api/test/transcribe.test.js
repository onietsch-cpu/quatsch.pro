import assert from 'node:assert/strict';
import test from 'node:test';
import { parseAudioDataUrl } from '../src/routes/transcribe.js';

test('parseAudioDataUrl accepts base64 audio data URLs', () => {
	const parsed = parseAudioDataUrl('data:audio/webm;codecs=opus;base64,aGVsbG8=');

	assert.equal(parsed.mimeType, 'audio/webm;codecs=opus');
	assert.equal(parsed.buffer.toString('utf8'), 'hello');
});

test('parseAudioDataUrl rejects non-audio data URLs', () => {
	assert.equal(parseAudioDataUrl('data:text/plain;base64,aGVsbG8='), null);
	assert.equal(parseAudioDataUrl('not-a-data-url'), null);
});
