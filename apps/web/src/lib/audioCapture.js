const MIME_TYPES = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm', 'audio/ogg;codecs=opus'];
// Below the API's 12 MiB JSON limit after base64 expansion.
const MAX_BYTES = 8 * 1024 * 1024;
export function isAudioCaptureSupported() {
	return typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia) && typeof MediaRecorder !== 'undefined';
}

// No silence or duration timer. Only finish() authorizes an upload.
export function createManualAudioTranscription({ langCode = '', transcribe, onResult, onError, onEnd, onState } = {}) {
	let stream, recorder;
	let state = 'starting';
	let bytes = 0;
	let cancelled = false;
	let submitted = false;
	let ended = false;
	const chunks = [];
	const abort = new AbortController();
	const change = (next) => { state = next; onState?.(next); };
	const release = () => stream?.getTracks().forEach((track) => track.stop());
	const end = () => { if (ended) return; ended = true; release(); onEnd?.(); };
	const fail = (error) => { if (cancelled || ended) return; cancelled = true; abort.abort(); release(); onError?.(error); end(); };
	const submit = async () => {
		if (cancelled || submitted || ended) return;
		submitted = true;
		change('transcribing');
		try {
			const text = await transcribe({ audioBlob: new Blob(chunks, { type: recorder.mimeType || 'audio/webm' }), sourceLanguageCode: langCode, signal: abort.signal });
			if (cancelled) return;
			if (!String(text || '').trim()) return fail({ error: 'no-speech' });
			onResult?.(String(text).trim());
			end();
		} catch (error) { fail({ error: error.code || 'network', detail: error }); }
	};
	const controller = {
		started: isAudioCaptureSupported() && typeof transcribe === 'function',
		pause() { if (state === 'recording') { recorder.pause(); stream.getAudioTracks().forEach((t) => { t.enabled = false; }); change('paused'); } },
		resume() { if (state === 'paused') { stream.getAudioTracks().forEach((t) => { t.enabled = true; }); recorder.resume(); change('recording'); } },
		hold() { if (state === 'recording' || state === 'paused') { change('stopping'); recorder.stop(); release(); } },
		finish() {
			if (state === 'stopped') { void submit(); return; }
			if (state !== 'recording' && state !== 'paused') return;
			submitted = false;
			change('finishing'); recorder.stop(); release();
		},
		stop() { cancelled = true; abort.abort(); if (recorder && recorder.state !== 'inactive') recorder.stop(); release(); end(); },
	};
	if (!controller.started) { queueMicrotask(() => fail({ error: 'blocked' })); return controller; }
	void (async () => {
		try {
			stream = await navigator.mediaDevices.getUserMedia({ audio: true });
			if (cancelled) { release(); return; }
			const mimeType = MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type));
			recorder = new MediaRecorder(stream, { ...(mimeType ? { mimeType } : {}), audioBitsPerSecond: 64000 });
			recorder.ondataavailable = ({ data }) => {
				if (cancelled || !data?.size) return;
				bytes += data.size;
				if (bytes > MAX_BYTES) { fail({ error: 'too-large' }); return; }
				chunks.push(data);
			};
			recorder.onerror = () => fail({ error: 'audio-capture' });
			recorder.onstop = () => {
				release();
				if (cancelled) return;
				if (state === 'finishing') { void submit(); return; }
				// OS/browser interruptions preserve captured audio without uploading it.
				change('stopped');
			};
			recorder.start(1000); change('recording');
		} catch (error) { fail({ error: error.name === 'NotAllowedError' ? 'not-allowed' : 'audio-capture' }); }
	})();
	return controller;
}
