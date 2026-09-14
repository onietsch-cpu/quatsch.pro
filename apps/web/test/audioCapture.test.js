import test from 'node:test';
import assert from 'node:assert/strict';
import { createManualAudioTranscription } from '../src/lib/audioCapture.js';

const tick = () => new Promise((resolve) => setImmediate(resolve));
function setup(t, options = {}) {
	const track = { enabled: true, stopped: false, stop() { this.stopped = true; } };
	const stream = { getTracks: () => [track], getAudioTracks: () => [track] };
	let instance;
	class Recorder {
		static isTypeSupported(type) { return type === (options.mime || 'audio/webm;codecs=opus'); }
		constructor(stream, opts) { this.mimeType = opts.mimeType; instance = this; }
		start() { this.state = 'recording'; }
		pause() { this.state = 'paused'; }
		resume() { this.state = 'recording'; }
		stop() { this.state = 'inactive'; queueMicrotask(() => { this.ondataavailable({ data: new Blob(['audio']) }); this.onstop(); }); }
	}
	const previousNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
	const previousRecorder = globalThis.MediaRecorder;
	Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { mediaDevices: { getUserMedia: options.getUserMedia || (async () => stream) } } });
	globalThis.MediaRecorder = Recorder;
	t.after(() => { if (previousNavigator) Object.defineProperty(globalThis, 'navigator', previousNavigator); else delete globalThis.navigator; globalThis.MediaRecorder = previousRecorder; });
	return { track, stream, recorder: () => instance };
}
for (const mime of ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg;codecs=opus']) {
	test(`manual pause, resume, stop and exactly one submission: ${mime}`, async (t) => {
		const fake = setup(t, { mime });
		const states = [], results = [], blobs = [];
		const controller = createManualAudioTranscription({ transcribe: async ({ audioBlob }) => { assert.equal(fake.track.stopped, true); blobs.push(audioBlob); return 'hello'; }, onState: (s) => states.push(s), onResult: (s) => results.push(s) });
		await tick();
		controller.pause(); assert.equal(fake.track.enabled, false); assert.equal(blobs.length, 0);
		controller.resume(); assert.equal(fake.track.enabled, true);
		controller.hold(); await tick(); assert.equal(states.at(-1), 'stopped'); assert.equal(blobs.length, 0);
		controller.finish(); controller.finish(); await tick();
		assert.deepEqual(results, ['hello']); assert.equal(blobs.length, 1); assert.equal(blobs[0].type, mime);
	});
}
test('browser interruption never authorizes upload; retained audio can be submitted manually', async (t) => {
	const fake = setup(t); let calls = 0;
	const c = createManualAudioTranscription({ transcribe: async () => { calls++; return 'retained'; } });
	await tick(); fake.recorder().stop(); await tick(); assert.equal(calls, 0);
	c.finish(); await tick(); assert.equal(calls, 1);
});
test('cancellation while microphone permission is pending releases late stream', async (t) => {
	let grant; const pending = new Promise((resolve) => { grant = resolve; });
	const fake = setup(t, { getUserMedia: () => pending }); let calls = 0;
	const c = createManualAudioTranscription({ transcribe: async () => { calls++; } }); c.stop(); grant(fake.stream); await tick();
	assert.equal(fake.track.stopped, true); assert.equal(calls, 0);
});
test('cancelled transcription cannot publish a stale result', async (t) => {
	setup(t); let resolve; const pending = new Promise((r) => { resolve = r; }); const results = [];
	const c = createManualAudioTranscription({ transcribe: () => pending, onResult: (s) => results.push(s) });
	await tick(); c.pause(); c.finish(); await tick(); c.stop(); resolve('stale'); await tick(); assert.deepEqual(results, []);
});
test('oversized recordings fail without uploading', async (t) => {
	const fake = setup(t); const errors = []; let calls = 0;
	createManualAudioTranscription({ transcribe: async () => { calls++; }, onError: (e) => errors.push(e.error) });
	await tick(); fake.recorder().ondataavailable({ data: new Blob([new Uint8Array(8 * 1024 * 1024 + 1)]) });
	assert.deepEqual(errors, ['too-large']); assert.equal(calls, 0); assert.equal(fake.track.stopped, true);
});
