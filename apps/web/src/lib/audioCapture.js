const DEFAULT_AUDIO_MIME_TYPES = [
	'audio/webm;codecs=opus',
	'audio/webm',
	'audio/mp4',
	'audio/ogg;codecs=opus',
];

function pickAudioMimeType() {
	if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') {
		return '';
	}
	return DEFAULT_AUDIO_MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type)) || '';
}

function stopTracks(stream) {
	for (const track of stream?.getTracks?.() || []) {
		try {
			track.stop();
		} catch {
			/* noop */
		}
	}
}

export function isAudioCaptureSupported() {
	return (
		typeof navigator !== 'undefined' &&
		Boolean(navigator.mediaDevices?.getUserMedia) &&
		typeof MediaRecorder !== 'undefined'
	);
}

export function createTimedAudioTranscription({
	langCode = '',
	maxDurationMs = 60_000,
	transcribe,
	onResult,
	onError,
	onEnd,
} = {}) {
	if (!isAudioCaptureSupported() || typeof transcribe !== 'function') {
		onError && onError({ error: 'blocked' });
		return { started: false, stop() {} };
	}

	let stream = null;
	let recorder = null;
	let timeoutId = null;
	let stopped = false;
	let finished = false;
	const chunks = [];
	const abortCtrl = new AbortController();

	const finish = () => {
		if (finished) return;
		finished = true;
		if (timeoutId) {
			clearTimeout(timeoutId);
			timeoutId = null;
		}
		stopTracks(stream);
		stream = null;
		onEnd && onEnd();
	};

	const fail = (error) => {
		if (finished) return;
		onError && onError(error);
		finish();
	};

	const start = async () => {
		try {
			stream = await navigator.mediaDevices.getUserMedia({
				audio: {
					echoCancellation: false,
					noiseSuppression: false,
					autoGainControl: true,
				},
			});
			if (stopped) {
				stopTracks(stream);
				return;
			}

			const mimeType = pickAudioMimeType();
			recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
			recorder.ondataavailable = (event) => {
				if (event.data?.size) {
					chunks.push(event.data);
				}
			};
			recorder.onerror = (event) => {
				fail({ error: 'audio-capture', detail: event.error || event });
			};
			recorder.onstop = async () => {
				if (stopped) {
					finish();
					return;
				}
				try {
					const type = recorder.mimeType || mimeType || 'audio/webm';
					const audioBlob = new Blob(chunks, { type });
					const text = await transcribe({
						audioBlob,
						sourceLanguageCode: langCode,
						signal: abortCtrl.signal,
					});
					const trimmed = String(text || '').trim();
					if (trimmed) {
						onResult && onResult(trimmed);
					} else {
						onError && onError({ error: 'no-speech' });
					}
					finish();
				} catch (error) {
					if (abortCtrl.signal.aborted) {
						finish();
						return;
					}
					fail({ error: error?.code || 'network', detail: error });
				}
			};

			recorder.start(1000);
			timeoutId = setTimeout(() => {
				if (finished || stopped || recorder?.state !== 'recording') return;
				try {
					recorder.stop();
				} catch {
					fail({ error: 'audio-capture' });
				}
			}, maxDurationMs);
		} catch (error) {
			fail({
				error: error?.name === 'NotAllowedError' ? 'not-allowed' : 'blocked',
				detail: error,
			});
		}
	};

	start();

	return {
		started: true,
		stop() {
			if (finished) return;
			stopped = true;
			abortCtrl.abort();
			if (timeoutId) {
				clearTimeout(timeoutId);
				timeoutId = null;
			}
			try {
				if (recorder?.state === 'recording') {
					recorder.stop();
				}
			} catch {
				/* noop */
			}
			stopTracks(stream);
			finish();
		},
	};
}
