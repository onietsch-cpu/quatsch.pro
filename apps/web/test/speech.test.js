import assert from 'node:assert/strict';
import test from 'node:test';
import {
	createTimedSpeechRecognition,
	SPEECH_INPUT_MAX_DURATION_MS,
} from '../src/lib/speech.js';

test('speech input limit defaults to 60 seconds', () => {
	assert.equal(SPEECH_INPUT_MAX_DURATION_MS, 60_000);
});

test('timed speech recognition submits interim transcript when the limit expires', async (t) => {
	const originalWindow = global.window;
	const instances = [];

	class FakeRecognition {
		start() {
			instances.push(this);
		}

		stop() {
			this.onend?.();
		}

		abort() {
			this.aborted = true;
		}
	}

	global.window = { SpeechRecognition: FakeRecognition };
	t.after(() => {
		global.window = originalWindow;
	});

	let captured = '';
	const ended = new Promise((resolve, reject) => {
		const controller = createTimedSpeechRecognition({
			maxDurationMs: 5,
			onResult: (text) => {
				captured = text;
			},
			onError: reject,
			onEnd: resolve,
		});
		assert.equal(controller.started, true);
	});

	instances[0].onresult({
		resultIndex: 0,
		results: [
			{
				0: { transcript: ' longer speaker input ' },
				isFinal: false,
			},
		],
	});

	await ended;
	assert.equal(captured, 'longer speaker input');
});
