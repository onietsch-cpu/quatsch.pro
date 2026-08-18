import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ConversationEngine, STATES } from '../../web/src/lib/conversationEngine.js';

const LANG_A = { code: 'en-US', name: 'English', native: 'English' };
const LANG_B = { code: 'de-DE', name: 'German', native: 'Deutsch' };

function createMockAdapters() {
	const calls = { recognize: 0, translate: 0, speak: 0, stopRecognize: 0, stopSpeak: 0 };
	const pending = { recognize: null, translate: null, speak: null };
	const adapters = {
		recognize({ langCode, onResult, onError, onEnd }) {
			calls.recognize += 1;
			pending.recognize = { langCode, onResult, onError, onEnd };
			return { stop() { calls.stopRecognize += 1; } };
		},
		translate(params) {
			calls.translate += 1;
			return new Promise((resolve, reject) => {
				pending.translate = { params, resolve, reject };
			});
		},
		speak({ text, langCode, onEnd, onError }) {
			calls.speak += 1;
			pending.speak = { text, langCode, onEnd, onError };
			return { stop() { calls.stopSpeak += 1; } };
		},
	};
	return { adapters, calls, pending };
}

function deliverResult(ctx, text) {
	const r = ctx.pending.recognize;
	ctx.pending.recognize = null;
	if (!r) throw new Error('no pending recognition');
	r.onResult(text);
}

function recognitionError(ctx, err) {
	const r = ctx.pending.recognize;
	ctx.pending.recognize = null;
	if (!r) throw new Error('no pending recognition');
	r.onError(err);
}

function resolveTranslate(ctx, result) {
	const t = ctx.pending.translate;
	ctx.pending.translate = null;
	if (!t) throw new Error('no pending translation');
	t.resolve(result);
}

function rejectTranslate(ctx, err) {
	const t = ctx.pending.translate;
	ctx.pending.translate = null;
	if (!t) throw new Error('no pending translation');
	t.reject(err);
}

function finishSpeak(ctx) {
	const s = ctx.pending.speak;
	ctx.pending.speak = null;
	if (!s) throw new Error('no pending speak');
	s.onEnd();
}

function waitFor(engine, predicate, timeout = 2000) {
	return new Promise((resolve, reject) => {
		let off = null;
		let done = false;
		const finish = (snap) => {
			if (done) return;
			done = true;
			clearTimeout(timer);
			if (off) off();
			resolve(snap);
		};
		const handler = (snap) => {
			if (predicate(snap)) finish(snap);
		};
		const timer = setTimeout(() => {
			if (done) return;
			done = true;
			if (off) off();
			reject(new Error(`timeout waiting for state: ${engine.state}`));
		}, timeout);
		off = engine.onState(handler);
		if (done && off) {
			off();
			off = null;
		}
	});
}

// Drive one full manual turn in an explicitly chosen direction. After the turn
// the engine must be back in AWAITING_TAP with the direction unchanged.
async function runTurn(ctx, engine, direction, text, translation) {
	engine.startListening(direction);
	await waitFor(engine, (s) => s.state === STATES.LISTENING);
	deliverResult(ctx, text);
	await waitFor(engine, (s) => s.state === STATES.TRANSLATING);
	resolveTranslate(ctx, {
		translation,
		detectedLanguageName: direction === 'AtoB' ? 'English' : 'German',
		detectedLanguageCode: direction === 'AtoB' ? 'en' : 'de',
	});
	await waitFor(engine, (s) => s.state === STATES.SPEAKING);
	finishSpeak(ctx);
	await waitFor(engine, (s) => s.state === STATES.AWAITING_TAP);
}

test('start() does not auto-activate the microphone — it waits for a button press', async () => {
	const ctx = createMockAdapters();
	const engine = new ConversationEngine({
		langA: LANG_A,
		langB: LANG_B,
		autoRead: true,
		rate: 1,
		adapters: ctx.adapters,
	});
	engine.onState(() => {});
	engine.start();
	await waitFor(engine, (s) => s.state === STATES.AWAITING_TAP);
	assert.equal(ctx.calls.recognize, 0, 'no recognition started automatically');
	assert.equal(engine.direction, 'AtoB');
	engine.end();
});

test('20 manually triggered rounds complete with no fixed limit', async () => {
	const ctx = createMockAdapters();
	const engine = new ConversationEngine({
		langA: LANG_A,
		langB: LANG_B,
		autoRead: true,
		rate: 1,
		adapters: ctx.adapters,
	});
	engine.onState(() => {});
	engine.start();
	await waitFor(engine, (s) => s.state === STATES.AWAITING_TAP);

	for (let i = 0; i < 20; i += 1) {
		const dir = i % 2 === 0 ? 'AtoB' : 'BtoA';
		await runTurn(ctx, engine, dir, `round ${i}`, dir === 'AtoB' ? `Runde ${i}` : `Round ${i}`);
		assert.equal(engine.direction, dir, `direction preserved after turn ${i}`);
		assert.equal(engine.state, STATES.AWAITING_TAP, `waiting after turn ${i}`);
	}

	assert.equal(engine.history.length, 20);
	assert.equal(ctx.calls.translate, 20);
	assert.equal(ctx.calls.recognize, 20, 'one recognition per manual press, no auto-starts');
	engine.end();
});

test('after a translation the engine waits for the next button press and keeps direction', async () => {
	const ctx = createMockAdapters();
	const engine = new ConversationEngine({
		langA: LANG_A,
		langB: LANG_B,
		autoRead: true,
		rate: 1,
		adapters: ctx.adapters,
	});
	engine.onState(() => {});
	engine.start();
	await waitFor(engine, (s) => s.state === STATES.AWAITING_TAP);

	engine.startListening('AtoB');
	await waitFor(engine, (s) => s.state === STATES.LISTENING);
	deliverResult(ctx, 'hello');
	await waitFor(engine, (s) => s.state === STATES.TRANSLATING);
	resolveTranslate(ctx, { translation: 'Hallo', detectedLanguageName: 'English', detectedLanguageCode: 'en' });
	await waitFor(engine, (s) => s.state === STATES.SPEAKING);
	finishSpeak(ctx);
	await waitFor(engine, (s) => s.state === STATES.AWAITING_TAP);

	assert.equal(engine.direction, 'AtoB', 'direction unchanged after turn');
	assert.equal(ctx.calls.recognize, 1, 'no automatic next recognition started');
	engine.end();
});

test('startListening sets the chosen direction and begins listening', async () => {
	const ctx = createMockAdapters();
	const engine = new ConversationEngine({
		langA: LANG_A,
		langB: LANG_B,
		autoRead: true,
		rate: 1,
		adapters: ctx.adapters,
	});
	engine.onState(() => {});
	engine.start();
	await waitFor(engine, (s) => s.state === STATES.AWAITING_TAP);
	assert.equal(engine.direction, 'AtoB');

	engine.startListening('BtoA');
	await waitFor(engine, (s) => s.state === STATES.LISTENING);
	assert.equal(engine.direction, 'BtoA');
	assert.equal(engine.speaker().code, 'de-DE');
	assert.equal(ctx.pending.recognize.langCode, 'de-DE');
	engine.end();
});

test('switchDirection changes direction without starting a recording', async () => {
	const ctx = createMockAdapters();
	const engine = new ConversationEngine({
		langA: LANG_A,
		langB: LANG_B,
		autoRead: true,
		rate: 1,
		adapters: ctx.adapters,
	});
	engine.onState(() => {});
	engine.start();
	await waitFor(engine, (s) => s.state === STATES.AWAITING_TAP);

	engine.switchDirection();
	assert.equal(engine.direction, 'BtoA');
	assert.equal(engine.state, STATES.AWAITING_TAP);
	assert.equal(ctx.calls.recognize, 0, 'no recording started by switchDirection');
	engine.end();
});

test('startListening is locked during translation and TTS', async () => {
	const ctx = createMockAdapters();
	const engine = new ConversationEngine({
		langA: LANG_A,
		langB: LANG_B,
		autoRead: true,
		rate: 1,
		adapters: ctx.adapters,
	});
	engine.onState(() => {});
	engine.start();
	await waitFor(engine, (s) => s.state === STATES.AWAITING_TAP);

	engine.startListening('AtoB');
	await waitFor(engine, (s) => s.state === STATES.LISTENING);
	deliverResult(ctx, 'hello');
	await waitFor(engine, (s) => s.state === STATES.TRANSLATING);

	engine.startListening('BtoA'); // must be ignored mid-translation
	assert.equal(engine.direction, 'AtoB');
	assert.equal(engine.state, STATES.TRANSLATING);
	assert.equal(ctx.calls.recognize, 1);

	resolveTranslate(ctx, { translation: 'Hallo', detectedLanguageName: 'English', detectedLanguageCode: 'en' });
	await waitFor(engine, (s) => s.state === STATES.SPEAKING);

	engine.startListening('BtoA'); // must be ignored during TTS
	assert.equal(engine.direction, 'AtoB');
	assert.equal(engine.state, STATES.SPEAKING);
	assert.equal(ctx.calls.recognize, 1);

	finishSpeak(ctx);
	await waitFor(engine, (s) => s.state === STATES.AWAITING_TAP);
	engine.end();
});

test('microphone stays closed during translation and TTS, TTS is never re-recorded', async () => {
	const ctx = createMockAdapters();
	const engine = new ConversationEngine({
		langA: LANG_A,
		langB: LANG_B,
		autoRead: true,
		rate: 1,
		adapters: ctx.adapters,
	});
	engine.onState(() => {});
	engine.start();
	await waitFor(engine, (s) => s.state === STATES.AWAITING_TAP);

	engine.startListening('AtoB');
	await waitFor(engine, (s) => s.state === STATES.LISTENING);
	deliverResult(ctx, 'hello');

	await waitFor(engine, (s) => s.state === STATES.TRANSLATING);
	assert.equal(ctx.pending.recognize, null, 'no active recognition while translating');

	resolveTranslate(ctx, { translation: 'Hallo', detectedLanguageName: 'English', detectedLanguageCode: 'en' });
	await waitFor(engine, (s) => s.state === STATES.SPEAKING);
	assert.equal(ctx.pending.recognize, null, 'no active recognition while speaking');
	assert.ok(ctx.pending.speak, 'TTS is active');

	finishSpeak(ctx);
	await waitFor(engine, (s) => s.state === STATES.AWAITING_TAP);
	assert.equal(ctx.pending.recognize, null, 'no auto-recognition after TTS');
	engine.end();
});

test('errors keep direction and do not auto-retry', async () => {
	const ctx = createMockAdapters();
	const engine = new ConversationEngine({
		langA: LANG_A,
		langB: LANG_B,
		autoRead: true,
		rate: 1,
		adapters: ctx.adapters,
	});
	engine.onState(() => {});
	engine.start();
	await waitFor(engine, (s) => s.state === STATES.AWAITING_TAP);

	engine.startListening('BtoA');
	await waitFor(engine, (s) => s.state === STATES.LISTENING);
	deliverResult(ctx, 'hallo');
	await waitFor(engine, (s) => s.state === STATES.TRANSLATING);

	// Server-side validation rejected the response (HTTP 502 -> code 'invalid').
	rejectTranslate(ctx, { code: 'invalid', message: 'not a real translation' });
	await waitFor(engine, (s) => s.state === STATES.ERROR);

	assert.equal(engine.direction, 'BtoA', 'direction unchanged on invalid response');
	assert.ok(engine.error, 'error surfaced');
	assert.equal(engine.history.length, 0, 'no history entry for rejected turn');
	assert.equal(ctx.calls.recognize, 1, 'no automatic retry started');

	// Manual retry re-attempts the same translation, keeping the direction.
	const translateCountBefore = ctx.calls.translate;
	engine.retry();
	await waitFor(engine, (s) => s.state === STATES.TRANSLATING);
	assert.equal(ctx.calls.translate, translateCountBefore + 1, 'retry triggered one new request');
	assert.equal(engine.direction, 'BtoA', 'direction still unchanged after retry start');
	engine.end();
});

test('recognition errors keep direction and history, no auto-retry', async () => {
	const ctx = createMockAdapters();
	const engine = new ConversationEngine({
		langA: LANG_A,
		langB: LANG_B,
		autoRead: true,
		rate: 1,
		adapters: ctx.adapters,
	});
	engine.onState(() => {});
	engine.start();
	await waitFor(engine, (s) => s.state === STATES.AWAITING_TAP);

	// Complete one turn successfully first.
	await runTurn(ctx, engine, 'AtoB', 'hello', 'Hallo');
	assert.equal(engine.history.length, 1);

	// Next manual press gets a no-speech error.
	engine.startListening('BtoA');
	await waitFor(engine, (s) => s.state === STATES.LISTENING);
	recognitionError(ctx, { error: 'no-speech' });
	await waitFor(engine, (s) => s.state === STATES.ERROR);

	assert.equal(engine.history.length, 1, 'history preserved');
	assert.equal(engine.direction, 'BtoA', 'direction preserved on no-speech');
	assert.notEqual(engine.state, STATES.ENDED);

	// Manual retry re-opens the microphone for the same speaker.
	engine.retry();
	await waitFor(engine, (s) => s.state === STATES.LISTENING);
	assert.equal(engine.direction, 'BtoA');
	engine.end();
});

test('pause and resume keep state, direction and history', async () => {
	const ctx = createMockAdapters();
	const engine = new ConversationEngine({
		langA: LANG_A,
		langB: LANG_B,
		autoRead: true,
		rate: 1,
		adapters: ctx.adapters,
	});
	engine.onState(() => {});
	engine.start();
	await waitFor(engine, (s) => s.state === STATES.AWAITING_TAP);

	await runTurn(ctx, engine, 'AtoB', 'hello', 'Hallo');
	await waitFor(engine, (s) => s.state === STATES.AWAITING_TAP);

	engine.startListening('BtoA');
	await waitFor(engine, (s) => s.state === STATES.LISTENING);
	engine.pause();
	await waitFor(engine, (s) => s.state === STATES.PAUSED);
	assert.equal(engine.history.length, 1, 'history kept on pause');
	assert.equal(engine.direction, 'BtoA', 'direction kept on pause');

	engine.resume();
	await waitFor(engine, (s) => s.state === STATES.AWAITING_TAP);
	assert.equal(engine.direction, 'BtoA', 'same direction after resume');
	assert.equal(ctx.calls.recognize, 2, 'resume does not auto-start a recording');
	engine.end();
});

test('end() is the only full abort and clears the session', async () => {
	const ctx = createMockAdapters();
	const engine = new ConversationEngine({
		langA: LANG_A,
		langB: LANG_B,
		autoRead: true,
		rate: 1,
		adapters: ctx.adapters,
	});
	engine.onState(() => {});
	engine.start();
	await waitFor(engine, (s) => s.state === STATES.AWAITING_TAP);

	await runTurn(ctx, engine, 'AtoB', 'hello', 'Hallo');
	await runTurn(ctx, engine, 'BtoA', 'hallo', 'Hello');
	assert.equal(engine.history.length, 2);

	engine.end();
	await waitFor(engine, (s) => s.state === STATES.ENDED);
	assert.equal(engine.history.length, 0, 'history cleared on end');
});

test('no double API calls on rapid repeated button presses', async () => {
	const ctx = createMockAdapters();
	const engine = new ConversationEngine({
		langA: LANG_A,
		langB: LANG_B,
		autoRead: true,
		rate: 1,
		adapters: ctx.adapters,
	});
	engine.onState(() => {});
	engine.start();
	await waitFor(engine, (s) => s.state === STATES.AWAITING_TAP);

	const recognizeBefore = ctx.calls.recognize;
	// Rapid-fire presses — only the first may start a recognition.
	engine.startListening('AtoB');
	engine.startListening('AtoB');
	engine.startListening('AtoB');
	engine.startListening('AtoB');
	engine.startListening('AtoB');
	await waitFor(engine, (s) => s.state === STATES.LISTENING);
	assert.equal(ctx.calls.recognize, recognizeBefore + 1, 'only one recognition started');
	engine.end();
});

test('a paused stale request cannot overwrite a newer translation', async () => {
	const pendingTranslations = [];
	const ctx = createMockAdapters();
	ctx.adapters.translate = (params) => {
		ctx.calls.translate += 1;
		return new Promise((resolve, reject) => {
			pendingTranslations.push({ params, resolve, reject });
		});
	};
	const engine = new ConversationEngine({
		langA: LANG_A,
		langB: LANG_B,
		autoRead: false,
		rate: 1,
		adapters: ctx.adapters,
	});
	engine.onState(() => {});
	engine.start();
	await waitFor(engine, (s) => s.state === STATES.AWAITING_TAP);

	engine.submitText('old');
	await waitFor(engine, (s) => s.state === STATES.TRANSLATING);
	engine.pause();
	await waitFor(engine, (s) => s.state === STATES.PAUSED);
	engine.resume();
	engine.submitText('new');
	await waitFor(engine, (s) => s.state === STATES.TRANSLATING);

	pendingTranslations[0].resolve({
		translation: 'veraltet',
		detectedLanguageName: 'English',
		detectedLanguageCode: 'en',
	});
	await new Promise((resolve) => setImmediate(resolve));
	assert.equal(engine.history.length, 0, 'stale result was ignored');

	pendingTranslations[1].resolve({
		translation: 'neu',
		detectedLanguageName: 'English',
		detectedLanguageCode: 'en',
	});
	await waitFor(engine, (s) => s.state === STATES.AWAITING_TAP);
	assert.equal(engine.history.length, 1);
	assert.equal(engine.lastEntry.translation, 'neu');
	engine.end();
});

test('autoRead disabled finishes the turn without TTS and waits for next press', async () => {
	const ctx = createMockAdapters();
	const engine = new ConversationEngine({
		langA: LANG_A,
		langB: LANG_B,
		autoRead: false,
		rate: 1,
		adapters: ctx.adapters,
	});
	engine.onState(() => {});
	engine.start();
	await waitFor(engine, (s) => s.state === STATES.AWAITING_TAP);

	engine.startListening('AtoB');
	await waitFor(engine, (s) => s.state === STATES.LISTENING);
	deliverResult(ctx, 'hello');
	await waitFor(engine, (s) => s.state === STATES.TRANSLATING);
	resolveTranslate(ctx, { translation: 'Hallo', detectedLanguageName: 'English', detectedLanguageCode: 'en' });

	// Without auto-read the engine must finish the turn and wait.
	await waitFor(engine, (s) => s.state === STATES.AWAITING_TAP);
	assert.equal(engine.direction, 'AtoB', 'direction unchanged');
	assert.equal(ctx.calls.speak, 0, 'no TTS was invoked');
	assert.equal(ctx.calls.recognize, 1, 'no auto-next recognition');
	engine.end();
});
