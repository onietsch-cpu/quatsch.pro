// ConversationEngine — a framework-agnostic state machine that drives the
// MANUAL, button-triggered two-language dialog. It has NO React dependencies so
// it can be unit-tested with mock adapters (see conversationEngine.test.js).
//
// IMPORTANT: This engine NEVER auto-activates the microphone and NEVER auto-
// advances to the other speaker. Every single conversation step is triggered by
// an explicit user action (startListening(direction) / tapToSpeak() /
// submitText()). After a translation (and optional TTS) the engine returns to
// the awaiting-tap state and KEEPS the last chosen direction, waiting for the
// next button press.
//
// States: 'idle' | 'listening' | 'translating' | 'speaking' | 'awaitingTap' |
//          'paused' | 'error' | 'ended'
//
// Direction: 'AtoB' (person A speaks langA → translated & spoken in langB)
//            'BtoA' (person B speaks langB → translated & spoken in langA)
//
// The engine guarantees:
//  - no automatic microphone activation — recording starts only via an explicit
//    startListening(direction) / tapToSpeak() call
//  - no automatic start of the next round and no automatic direction switch
//    after a translation or TTS; the engine waits for the next button press
//  - the last chosen direction persists across turns; the engine never changes
//    it on its own
//  - the microphone is never active during translation or TTS, and TTS output is
//    never re-recorded
//  - startListening / tapToSpeak are ignored while a recording, translation or
//    TTS is in progress (further recording commands are locked)
//  - errors / no-speech / network drops do NOT end the dialog, do NOT change the
//    direction and do NOT auto-retry; they surface an error state with a manual
//    retry action and KEEP the current direction
//  - pause stops mic + audio but keeps languages, direction and history; resume
//    returns to the awaiting-tap state for the same speaker
//  - only end() clears the session
//  - there is no fixed round limit — manually triggered turns repeat forever
//  - parallel recordings / translations / double requests are prevented through
//    a single state machine, a generation token and an AbortController.

export const STATES = {
	IDLE: 'idle',
	LISTENING: 'listening',
	TRANSLATING: 'translating',
	SPEAKING: 'speaking',
	AWAITING_TAP: 'awaitingTap',
	PAUSED: 'paused',
	ERROR: 'error',
	ENDED: 'ended',
};

function baseCode(code) {
	return String(code || '').toLowerCase().split('-')[0];
}

export class ConversationEngine {
	/**
	 * @param {Object} opts
	 * @param {{code,name,native}} opts.langA
	 * @param {{code,name,native}} opts.langB
	 * @param {boolean} opts.autoRead
	 * @param {number} opts.rate
	 * @param {Object} opts.adapters
	 *   recognize({ langCode, onResult, onError, onEnd }) -> { stop() }
	 *   translate({ text, sourceLanguageCode, targetLanguageCode, targetLanguageName, requestId, signal }) -> Promise<{translation, detectedLanguageName, detectedLanguageCode}>
	 *   speak({ text, langCode, rateMultiplier, onStart, onEnd, onError }) -> { stop() }
	 */
	constructor({ langA, langB, autoRead = true, rate = 1, adapters }) {
		this.langA = langA;
		this.langB = langB;
		this.autoRead = autoRead;
		this.rate = rate;
		this.adapters = adapters;

		this.state = STATES.IDLE;
		this.direction = 'AtoB';
		this.history = [];
		this.lastEntry = null;
		this.error = null;

		// Internal control refs
		this._generation = 0; // invalidates stale async callbacks
		this._requestId = 0; // unique per translation request
		this._abortCtrl = null; // AbortController for in-flight translation
		this._recognizer = null; // current recognition controller
		this._speaker = null; // current TTS controller
		this._speakTimeout = null; // safety timeout for TTS onend
		this._retryAction = null; // { type, payload } for retry()
		this._resultHandled = false; // per-listen flag
		this._listeners = new Set();
	}

	// --- subscription -------------------------------------------------------
	onState(cb) {
		this._listeners.add(cb);
		cb(this._snapshot());
		return () => this._listeners.delete(cb);
	}

	_emit() {
		const snap = this._snapshot();
		this._listeners.forEach((cb) => {
			try {
				cb(snap);
			} catch {
				/* noop */
			}
		});
	}

	_snapshot() {
		return {
			state: this.state,
			direction: this.direction,
			error: this.error,
			lastEntry: this.lastEntry,
			history: this.history,
			langA: this.langA,
			langB: this.langB,
			speaker: this.speaker(),
			target: this.target(),
		};
	}

	// --- derived helpers ----------------------------------------------------
	speaker() {
		return this.direction === 'AtoB' ? this.langA : this.langB;
	}
	target() {
		return this.direction === 'AtoB' ? this.langB : this.langA;
	}

	_setState(state, extra = {}) {
		this.state = state;
		if (extra.error !== undefined) this.error = extra.error;
		this._emit();
	}

	_bump() {
		this._generation += 1;
		return this._generation;
	}

	_stopAll() {
		if (this._recognizer) {
			try {
				this._recognizer.stop();
			} catch {
				/* noop */
			}
			this._recognizer = null;
		}
		if (this._speaker) {
			try {
				this._speaker.stop();
			} catch {
				/* noop */
			}
			this._speaker = null;
		}
		if (this._speakTimeout) {
			clearTimeout(this._speakTimeout);
			this._speakTimeout = null;
		}
		if (this._abortCtrl) {
			try {
				this._abortCtrl.abort();
			} catch {
				/* noop */
			}
			this._abortCtrl = null;
		}
	}

	// --- public API ---------------------------------------------------------
	start() {
		if (this.state !== STATES.IDLE && this.state !== STATES.ENDED) return;
		this.history = [];
		this.lastEntry = null;
		this.error = null;
		this.direction = 'AtoB';
		// Do NOT auto-start listening. Wait for an explicit button press.
		this._setState(STATES.AWAITING_TAP);
	}

	// Start a recording in an explicitly chosen direction. This is the primary
	// entry point for the two-button UI. Ignored unless the engine is waiting
	// for a button press (so recording commands are locked during translation /
	// TTS / active recording).
	startListening(direction) {
		if (this.state !== STATES.AWAITING_TAP) return;
		if (direction !== 'AtoB' && direction !== 'BtoA') return;
		this.direction = direction;
		this.error = null;
		this._retryAction = null;
		this._beginListening();
	}

	// Start a recording in the current direction (single-button / tap fallback).
	tapToSpeak() {
		if (this.state !== STATES.AWAITING_TAP) return;
		this.error = null;
		this._retryAction = null;
		this._beginListening();
	}

	retry() {
		if (this.state !== STATES.ERROR) return;
		const action = this._retryAction || { type: 'listen' };
		this.error = null;
		if (action.type === 'translate') {
			this._beginTranslation(action.payload);
		} else if (action.type === 'speak') {
			this._beginSpeaking(action.payload);
		} else {
			this._beginListening();
		}
	}

	pause() {
		if (
			this.state !== STATES.LISTENING &&
			this.state !== STATES.TRANSLATING &&
			this.state !== STATES.SPEAKING &&
			this.state !== STATES.AWAITING_TAP
		) {
			return;
		}
		this._stopAll();
		this._setState(STATES.PAUSED);
	}

	resume() {
		if (this.state !== STATES.PAUSED) return;
		this.error = null;
		// Resume waits for an explicit button press too — no auto-listening.
		this._setState(STATES.AWAITING_TAP);
	}

	// Change the selected direction WITHOUT starting a recording. Only allowed
	// while waiting for a button press (or paused / error), so it can never
	// interrupt an active turn.
	switchDirection() {
		if (
			this.state !== STATES.AWAITING_TAP &&
			this.state !== STATES.ERROR &&
			this.state !== STATES.PAUSED
		) {
			return;
		}
		this.direction = this.direction === 'AtoB' ? 'BtoA' : 'AtoB';
		this.error = null;
		this._retryAction = null;
		this._emit();
	}

	// Stop the current TTS playback and finish the turn (return to awaiting-tap,
	// keeping the direction). Bumps the generation so the pending TTS onend
	// callback is ignored.
	skipSpeech() {
		if (this.state !== STATES.SPEAKING) return;
		this._bump();
		this._finishTurn();
	}

	// Dismiss an error without retrying: return to the awaiting-tap state for
	// the current speaker (direction unchanged, history preserved).
	dismissError() {
		if (this.state !== STATES.ERROR) return;
		this.error = null;
		this._retryAction = null;
		this._setState(STATES.AWAITING_TAP);
	}

	submitText(text) {
		const trimmed = String(text || '').trim();
		if (!trimmed) return;
		// Only accept typed input when waiting for a button press (no active
		// voice turn is in progress).
		if (
			this.state !== STATES.AWAITING_TAP &&
			this.state !== STATES.ERROR &&
			this.state !== STATES.PAUSED
		) {
			return;
		}
		if (trimmed.length > 5000) {
			this._retryAction = { type: 'listen' };
			this._setState(STATES.ERROR, {
				error: { message: 'Text must not exceed 5,000 characters.', kind: 'listen' },
			});
			return;
		}
		this.error = null;
		this._retryAction = null;
		this._beginTranslation(trimmed);
	}

	end() {
		this._stopAll();
		this.history = [];
		this.lastEntry = null;
		this.error = null;
		this._retryAction = null;
		this._setState(STATES.ENDED);
	}

	// --- internal flow ------------------------------------------------------
	_beginListening() {
		this._stopAll();
		const gen = this._bump();
		this._resultHandled = false;
		this._retryAction = { type: 'listen' };
		this._setState(STATES.LISTENING);

		const langCode = this.speaker().code;

		let recognizer;
		try {
			recognizer = this.adapters.recognize({
				langCode,
				onResult: (text) => {
					if (gen !== this._generation) return;
					const trimmed = String(text || '').trim();
					if (!trimmed) return;
					this._resultHandled = true;
					this._beginTranslation(trimmed);
				},
				onError: (err) => {
					if (gen !== this._generation) return;
					this._handleRecognitionError(err);
				},
				onEnd: () => {
					if (gen !== this._generation) return;
					// Natural end without a usable result → treat as no-speech.
					if (!this._resultHandled && this.state === STATES.LISTENING) {
						this._handleRecognitionError({ error: 'no-speech' });
					}
				},
			});
		} catch (e) {
			this._handleRecognitionError({ error: 'blocked', detail: e });
			return;
		}
		this._recognizer = recognizer;
	}

	_handleRecognitionError(err) {
		const code = (err && err.error) || 'unknown';
		if (code === 'aborted' || code === 'interrupted') {
			// Caused by our own stop() — ignore silently.
			return;
		}
		if (code === 'blocked') {
			// Auto re-activation blocked (mobile autoplay/mic policy). Show the
			// "tap to speak" button without ending or resetting the dialog.
			this._stopAll();
			this._setState(STATES.AWAITING_TAP);
			return;
		}
		let message;
		if (code === 'not-allowed' || code === 'service-not-allowed') {
			message =
				'Microphone access was not granted. Please allow microphone access or use text input.';
		} else if (code === 'no-speech') {
			message = 'Nothing could be understood. Please speak more clearly or try again.';
		} else if (code === 'network') {
			message = 'No internet connection for speech recognition. Please check your connection.';
		} else {
			message = 'Speech recognition failed. Please try again.';
		}
		this._stopAll();
		this._retryAction = { type: 'listen' };
		this._setState(STATES.ERROR, { error: { message, kind: 'listen' } });
	}

	async _beginTranslation(text) {
		this._stopAll(); // stop recognition before translating
		const gen = this._bump(); // invalidate every older async result
		this._retryAction = { type: 'translate', payload: text };
		this._setState(STATES.TRANSLATING);

		const ctrl = new AbortController();
		this._abortCtrl = ctrl;
		const requestId = `conv-${Date.now()}-${(this._requestId += 1)}`;
		const target = this.target();

		try {
			const result = await this.adapters.translate({
				text,
				sourceLanguageCode: this.speaker().code,
				targetLanguageCode: target.code,
				targetLanguageName: target.name,
				requestId,
				signal: ctrl.signal,
			});

			if (gen !== this._generation) return; // superseded

			const entry = {
				id: Date.now() + Math.random(),
				original: text,
				translation: result.translation,
				detectedLanguageName: result.detectedLanguageName,
				detectedLanguageCode: result.detectedLanguageCode,
				sourceCode: this.speaker().code,
				targetCode: target.code,
				direction: this.direction,
				at: Date.now(),
			};

			this.history.push(entry);
			this.lastEntry = entry;
			this._emit();

			if (this.autoRead) {
				this._beginSpeaking(entry);
			} else {
				// No TTS: show the translation, then finish the turn (wait for the
				// next explicit button press). Direction is NOT changed.
				this._finishTurn();
			}
		} catch (e) {
			if (gen !== this._generation) return; // superseded
			const code = (e && e.code) || 'unknown';
			if (code === 'aborted') return; // our abort — ignore
			let message;
			if (code === 'offline') {
				message = 'No internet connection. Please check your connection and try again.';
			} else if (code === 'invalid') {
				message =
					e && e.message
						? e.message
						: 'The translation could not be produced in the target language. Please try again.';
			} else if (code === 'network') {
				message = 'The translation service is unreachable. Please check your connection.';
			} else {
				message = 'The translation failed. Please try again.';
			}
			this._abortCtrl = null;
			this._retryAction = { type: 'translate', payload: text };
			this._setState(STATES.ERROR, { error: { message, kind: 'translate' } });
		}
	}

	_beginSpeaking(entry) {
		const gen = this._generation;
		this._stopAll();
		this._retryAction = { type: 'speak', payload: entry };
		this._setState(STATES.SPEAKING);

		let ended = false;
		const finish = () => {
			if (ended) return;
			ended = true;
			if (this._speakTimeout) {
				clearTimeout(this._speakTimeout);
				this._speakTimeout = null;
			}
		};

		const onEnd = () => {
			finish();
			if (gen !== this._generation) return;
			this._finishTurn();
		};

		const onError = (info) => {
			finish();
			if (gen !== this._generation) return;
			// TTS failure is non-fatal: the translation already succeeded, so
			// finish the turn (wait for the next button press) instead of ending.
			this._finishTurn();
		};

		let speaker;
		try {
			speaker = this.adapters.speak({
				text: entry.translation,
				langCode: entry.targetCode,
				rateMultiplier: this.rate,
				onStart: () => {},
				onEnd,
				onError,
			});
		} catch {
			onError();
			return;
		}
		this._speaker = speaker;

		// Safety net: some mobile WebViews never fire onend for long utterances.
		// Force-finish after a generous bound so the dialog never gets stuck.
		const text = entry.translation || '';
		const ms = Math.max(8000, text.length * 130);
		this._speakTimeout = setTimeout(() => {
			if (gen !== this._generation) return;
			onEnd();
		}, ms);
	}

	// Finish the current turn: stop everything, return to the awaiting-tap
	// state and KEEP the current direction. The engine never auto-starts the
	// next recording and never switches direction here.
	_finishTurn() {
		this._stopAll();
		this._setState(STATES.AWAITING_TAP);
	}
}

export function baseLanguageCode(code) {
	return baseCode(code);
}
