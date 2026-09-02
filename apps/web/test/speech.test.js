import assert from 'node:assert/strict';
import test from 'node:test';
import {
	createTimedSpeechRecognition,
	SPEECH_INPUT_END_PAUSE_MS,
	SPEECH_INPUT_MAX_DURATION_MS,
} from '../src/lib/speech.js';
import { DIALOG_LANGUAGES } from '../src/lib/languages.js';

test('speech input limit defaults to 60 seconds', () => {
	assert.equal(SPEECH_INPUT_MAX_DURATION_MS, 60_000);
	assert.equal(SPEECH_INPUT_END_PAUSE_MS, 1_600);
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

test('timed speech recognition replaces interim text with the final transcript', async (t) => {
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
			maxDurationMs: 100,
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
				0: { transcript: ' hallo, wie geht es dir ' },
				isFinal: false,
			},
		],
	});
	instances[0].onresult({
		resultIndex: 0,
		results: [
			{
				0: { transcript: ' hallo, wie geht es dir ' },
				isFinal: true,
			},
		],
	});
	instances[0].onend();

	await ended;
	assert.equal(captured, 'hallo, wie geht es dir');
});

test('timed speech recognition updates repeated final result indexes instead of duplicating them', async (t) => {
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
			maxDurationMs: 100,
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
				0: { transcript: ' hallo ' },
				isFinal: true,
			},
		],
	});
	instances[0].onresult({
		resultIndex: 0,
		results: [
			{
				0: { transcript: ' hallo ' },
				isFinal: true,
			},
		],
	});
	instances[0].onresult({
		resultIndex: 1,
		results: [
			{
				0: { transcript: ' hallo ' },
				isFinal: true,
			},
			{
				0: { transcript: ' wie geht es dir ' },
				isFinal: true,
			},
		],
	});
	instances[0].onend();

	await ended;
	assert.equal(captured, 'hallo wie geht es dir');
});

test('timed speech recognition collapses cumulative Android Chrome final fragments', async (t) => {
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
			maxDurationMs: 100,
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
				0: { transcript: ' hallo ' },
				isFinal: true,
			},
		],
	});
	instances[0].onresult({
		resultIndex: 1,
		results: [
			{
				0: { transcript: ' hallo ' },
				isFinal: true,
			},
			{
				0: { transcript: ' hallo wie ' },
				isFinal: true,
			},
		],
	});
	instances[0].onresult({
		resultIndex: 2,
		results: [
			{
				0: { transcript: ' hallo ' },
				isFinal: true,
			},
			{
				0: { transcript: ' hallo wie ' },
				isFinal: true,
			},
			{
				0: { transcript: ' hallo wie geht es ' },
				isFinal: true,
			},
		],
	});
	instances[0].onresult({
		resultIndex: 3,
		results: [
			{
				0: { transcript: ' hallo ' },
				isFinal: true,
			},
			{
				0: { transcript: ' hallo wie ' },
				isFinal: true,
			},
			{
				0: { transcript: ' hallo wie geht es ' },
				isFinal: true,
			},
			{
				0: { transcript: ' hallo wie geht es dir ' },
				isFinal: true,
			},
		],
	});
	instances[0].onend();

	await ended;
	assert.equal(captured, 'hallo wie geht es dir');
});

test('timed speech recognition can finish early and submit the current transcript', async (t) => {
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
			maxDurationMs: 60_000,
			onResult: (text) => {
				captured = text;
			},
			onError: reject,
			onEnd: resolve,
		});
		assert.equal(controller.started, true);

		instances[0].onresult({
			resultIndex: 0,
			results: [
				{
					0: { transcript: ' hallo, wie geht es dir ' },
					isFinal: false,
				},
			],
		});
		controller.finish();
	});

	await ended;
	assert.equal(captured, 'hallo, wie geht es dir');
});

test('timed speech recognition submits after the configured end-of-speech pause', async (t) => {
	const originalWindow = global.window;
	const instances = [];

	class FakeRecognition {
		start() {
			instances.push(this);
		}

		stop() {
			this.stopped = true;
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
			maxDurationMs: 1_000,
			endPauseMs: 5,
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
				0: { transcript: ' see you tomorrow ' },
				isFinal: false,
			},
		],
	});
	await new Promise((resolve) => setTimeout(resolve, 10));
	assert.equal(instances[0].stopped, undefined, 'transcript updates alone do not imply silence');
	instances[0].onspeechend();

	await ended;
	assert.equal(instances[0].stopped, true);
	assert.equal(captured, 'see you tomorrow');
});

test('timed speech recognition handles speech-end before a delayed transcript result', async (t) => {
	const originalWindow = global.window;
	const instances = [];

	class FakeRecognition {
		start() {
			instances.push(this);
		}

		stop() {
			this.stopped = true;
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
		createTimedSpeechRecognition({
			maxDurationMs: 1_000,
			endPauseMs: 5,
			onResult: (text) => {
				captured = text;
			},
			onError: reject,
			onEnd: resolve,
		});
	});

	instances[0].onspeechend();
	await new Promise((resolve) => setTimeout(resolve, 10));
	assert.equal(instances[0].stopped, undefined, 'speech-end waits for a usable transcript');
	instances[0].onresult({
		resultIndex: 0,
		results: [
			{
				0: { transcript: ' short utterance ' },
				isFinal: true,
			},
		],
	});

	await ended;
	assert.equal(instances[0].stopped, true);
	assert.equal(captured, 'short utterance');
});

test('single-utterance recognition stops and submits as soon as Chrome returns a final result', async (t) => {
	const originalWindow = global.window;
	const instances = [];

	class FakeRecognition {
		start() {
			instances.push(this);
		}

		stop() {
			this.stopped = true;
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
		createTimedSpeechRecognition({
			continuous: false,
			maxDurationMs: 1_000,
			onResult: (text) => {
				captured = text;
			},
			onError: reject,
			onEnd: resolve,
		});
	});

	assert.equal(instances[0].continuous, false);
	instances[0].onresult({
		resultIndex: 0,
		results: [
			{
				0: { transcript: ' hello from chrome ' },
				isFinal: true,
			},
		],
	});

	await ended;
	assert.equal(instances[0].stopped, true);
	assert.equal(captured, 'hello from chrome');
});


test('conversation recognition does not translate a final fragment before the pause expires', async (t) => {
	const originalWindow = global.window;
	const instances = [];

	class FakeRecognition {
		start() {
			instances.push(this);
		}

		stop() {
			this.stopped = true;
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
		createTimedSpeechRecognition({
			continuous: true,
			maxDurationMs: 1_000,
			endPauseMs: 25,
			onResult: (text) => {
				captured = text;
			},
			onError: reject,
			onEnd: resolve,
		});
	});

	instances[0].onspeechstart();
	instances[0].onresult({
		resultIndex: 0,
		results: [
			{
				0: { transcript: ' wait for the full pause ' },
				isFinal: true,
			},
		],
	});
	instances[0].onspeechend();
	instances[0].onend();

	await new Promise((resolve) => setTimeout(resolve, 5));
	assert.equal(captured, '', 'translation is still pending inside the pause window');

	await ended;
	assert.equal(captured, 'wait for the full pause');
});

test('speech recognition accepts every Conversation Mode locale', (t) => {
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

	for (const language of DIALOG_LANGUAGES) {
		const controller = createTimedSpeechRecognition({
			langCode: language.code,
			maxDurationMs: 1_000,
			endPauseMs: SPEECH_INPUT_END_PAUSE_MS,
		});
		const recognition = instances.at(-1);
		assert.equal(recognition.lang, language.code, language.name);
		assert.equal(recognition.continuous, true, language.name);
		controller.stop();
	}
	assert.equal(instances.length, DIALOG_LANGUAGES.length);
});
