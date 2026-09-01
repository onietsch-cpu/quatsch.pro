import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Helmet } from 'react-helmet';
import {
	Mic,
	Loader2,
	Send,
	ShieldCheck,
	AlertTriangle,
	LogOut,
	X,
	Pause,
	Play,
	RotateCw,
	Volume2,
	StopCircle,
	ArrowRight,
	Copy,
	Check,
} from 'lucide-react';
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ConversationEngine, STATES } from '@/lib/conversationEngine';
import { getLanguageByCode } from '@/lib/languages';
import { translateConversation } from '@/lib/translateClient';
import { transcribeAudio } from '@/lib/transcriptionClient';
import { createTimedAudioTranscription, isAudioCaptureSupported } from '@/lib/audioCapture';
import {
	speak,
	stopSpeaking,
	loadVoices,
	onVoicesChanged,
	isSpeechRecognitionSupported,
	createTimedSpeechRecognition,
	SPEECH_INPUT_MAX_DURATION_MS,
} from '@/lib/speech';
import { addHistoryEntry, getSettings } from '@/lib/storage';
import { copyTextToClipboard } from '@/lib/clipboard';

// Render at most this many history entries in the DOM to keep long
// conversations performant. Older turns are collapsed, never deleted.
const MAX_RENDERED_TURNS = 60;

const STATE_LABEL = {
	[STATES.IDLE]: 'Ready',
	[STATES.LISTENING]: 'Listening',
	[STATES.TRANSLATING]: 'Translating',
	[STATES.SPEAKING]: 'Reading aloud',
	[STATES.AWAITING_TAP]: 'Tap to speak',
	[STATES.PAUSED]: 'Paused',
	[STATES.ERROR]: 'Error',
	[STATES.ENDED]: 'Ended',
};

export default function ConversationView({ langACode, langBCode, onEndDialog }) {
	const langA = useMemo(() => getLanguageByCode(langACode), [langACode]);
	const langB = useMemo(() => getLanguageByCode(langBCode), [langBCode]);

	const [snap, setSnap] = useState(null);
	const [settings, setSettings] = useState(() => getSettings());
	const [confirmOpen, setConfirmOpen] = useState(false);
	const [textInput, setTextInput] = useState('');
	const [nearbySpeakerMode, setNearbySpeakerMode] = useState(false);
	const [recognitionSupported] = useState(() => Boolean(isSpeechRecognitionSupported()));
	const [audioCaptureSupported] = useState(() => Boolean(isAudioCaptureSupported()));

	const engineRef = useRef(null);
	const honeypotRef = useRef(null);
	const lastSavedIdRef = useRef(null);
	const bottomRef = useRef(null);
	const nearbySpeakerModeRef = useRef(false);

	const scrollToBottom = useCallback((behavior = 'auto') => {
		if (typeof window === 'undefined') return;
		const bottom = bottomRef.current;
		if (!bottom) return;
		bottom.scrollIntoView({ behavior, block: 'end' });
		window.scrollTo({ top: document.documentElement.scrollHeight, behavior });
	}, []);

	useEffect(() => {
		nearbySpeakerModeRef.current = nearbySpeakerMode;
	}, [nearbySpeakerMode]);

	// Build the engine once with real adapters.
	useEffect(() => {
		if (!langA || !langB) return;

		const engine = new ConversationEngine({
			langA,
			langB,
			autoRead: getSettings().autoRead,
			rate: getSettings().rate,
			adapters: {
				recognize({ langCode, onResult, onError, onEnd }) {
					if (nearbySpeakerModeRef.current) {
						return createTimedAudioTranscription({
							langCode,
							maxDurationMs: SPEECH_INPUT_MAX_DURATION_MS,
							transcribe: transcribeAudio,
							onResult,
							onError,
							onEnd,
						});
					}
					return createTimedSpeechRecognition({
						langCode,
						maxDurationMs: SPEECH_INPUT_MAX_DURATION_MS,
						onResult,
						onError,
						onEnd,
					});
				},
				translate(params) {
					return translateConversation({
						...params,
						honeypot: honeypotRef.current?.value ?? '',
					});
				},
				speak({ text, langCode, rateMultiplier, onStart, onEnd, onError }) {
					speak(text, langCode, { rateMultiplier, onStart, onEnd, onError });
					return { stop() { stopSpeaking(); } };
				},
			},
		});

		engineRef.current = engine;
		const off = engine.onState(setSnap);
		engine.start();

		return () => {
			off();
			engine.end();
			engineRef.current = null;
		};
	}, [langA, langB]);

	// Keep autoRead / rate in sync with settings (e.g. changed in Settings page).
	useEffect(() => {
		const onFocus = () => {
			const s = getSettings();
			setSettings(s);
			const engine = engineRef.current;
			if (engine) {
				engine.autoRead = s.autoRead;
				engine.rate = s.rate;
			}
		};
		window.addEventListener('focus', onFocus);
		return () => window.removeEventListener('focus', onFocus);
	}, []);

	useEffect(() => {
		loadVoices();
		const off = onVoicesChanged(() => {});
		return off;
	}, []);

	// Persist new turns to the global history (when enabled) and auto-scroll.
	useEffect(() => {
		const entry = snap?.lastEntry;
		if (entry && entry.id !== lastSavedIdRef.current) {
			lastSavedIdRef.current = entry.id;
			if (settings.saveHistory) {
				addHistoryEntry({
					original: entry.original,
					translation: entry.translation,
					detectedLanguageName: entry.detectedLanguageName,
					targetName: getLanguageByCode(entry.targetCode)?.name,
				});
			}
		}
	}, [snap?.lastEntry, settings.saveHistory]);

	useEffect(() => {
		const raf = window.requestAnimationFrame(() => scrollToBottom('auto'));
		return () => window.cancelAnimationFrame(raf);
	}, [snap?.history?.length, snap?.state, snap?.error, scrollToBottom]);

	const state = snap?.state || STATES.IDLE;
	const direction = snap?.direction || 'AtoB';
	const error = snap?.error || null;
	const history = snap?.history || [];

	// A direction button press: starts a recording in the chosen direction when
	// idle, or stops the active recording when pressing the currently active
	// direction while listening. Locked during translation / TTS / error.
	const handleDirectionPress = useCallback(
		(dir) => {
			const engine = engineRef.current;
			if (!engine) return;
			if (state === STATES.LISTENING) {
				// Pressing the active mic button cancels the ongoing recording.
				if (engine.direction === dir) {
					engine.pause();
				}
				return;
			}
			if (state === STATES.AWAITING_TAP) {
				engine.startListening(dir);
				scrollToBottom('smooth');
			}
			// TRANSLATING / SPEAKING / ERROR / PAUSED: locked (error has its own
			// retry controls; paused has a resume control).
		},
		[state, scrollToBottom],
	);

	const handleRetry = useCallback(() => engineRef.current?.retry(), []);
	const handlePause = useCallback(() => engineRef.current?.pause(), []);
	const handleResume = useCallback(() => engineRef.current?.resume(), []);
	const handleStopSpeaking = useCallback(() => {
		engineRef.current?.skipSpeech();
	}, []);

	const handleDismissError = useCallback(() => {
		engineRef.current?.dismissError();
	}, []);

	const handleTextSubmit = useCallback(() => {
		const value = textInput.trim();
		if (!value) return;
		engineRef.current?.submitText(value);
		setTextInput('');
		scrollToBottom('smooth');
	}, [textInput, scrollToBottom]);

	const confirmEnd = useCallback(() => {
		engineRef.current?.end();
		stopSpeaking();
		setConfirmOpen(false);
		onEndDialog();
	}, [onEndDialog]);

	if (!langA || !langB) {
		return null;
	}

	const renderedHistory = history.slice(-MAX_RENDERED_TURNS);
	const hiddenCount = Math.max(0, history.length - MAX_RENDERED_TURNS);

	const isBusy =
		state === STATES.TRANSLATING || state === STATES.SPEAKING || state === STATES.LISTENING;
	const canSubmitText =
		state === STATES.AWAITING_TAP || state === STATES.ERROR || state === STATES.PAUSED;
	const speechInputSupported = nearbySpeakerMode ? audioCaptureSupported : recognitionSupported;

	const statusText =
		(state === STATES.LISTENING &&
			`${nearbySpeakerMode ? 'Listening to nearby speaker audio' : 'Listening'} — ${
				direction === 'AtoB' ? langA.name : langB.name
			} · up to 60 seconds`) ||
		(state === STATES.TRANSLATING && 'Translating — please wait …') ||
		(state === STATES.SPEAKING && `Reading aloud — ${direction === 'AtoB' ? langB.name : langA.name}`) ||
		(state === STATES.PAUSED && 'Paused') ||
		(state === STATES.ERROR && 'Could not continue — retry or switch direction') ||
		(state === STATES.AWAITING_TAP && 'Choose a direction and press the microphone button') ||
		'Starting …';

	return (
		<div className="flex min-h-[100dvh] flex-col bg-slate-50">
			<Helmet>
				<title>CE Translator – Conversation</title>
				<meta
					name="description"
					content="Manual two-language conversation — each step is triggered by an explicit button press. No automatic alternation, no round limit."
				/>
			</Helmet>

			{/* Header: both languages, current state, last active direction */}
			<header className="sticky top-0 z-10 border-b border-slate-100 bg-white/95 backdrop-blur">
				<div className="mx-auto w-full max-w-lg px-5 py-3">
					<div className="flex items-center justify-between gap-2">
						<span
							className={`flex-1 rounded-xl px-3 py-2 text-center text-sm font-bold transition-colors ${
								direction === 'AtoB' ? 'bg-[#1976D2] text-white' : 'bg-slate-100 text-slate-500'
							}`}
						>
							{langA.name}
						</span>
						<span className="shrink-0 text-slate-300">
							<ArrowRight className="h-4 w-4" />
						</span>
						<span
							className={`flex-1 rounded-xl px-3 py-2 text-center text-sm font-bold transition-colors ${
								direction === 'BtoA' ? 'bg-teal-500 text-white' : 'bg-slate-100 text-slate-500'
							}`}
						>
							{langB.name}
						</span>
					</div>
					<div className="mt-2 flex items-center justify-center gap-2 text-xs font-semibold">
						<StateBadge state={state} />
						<span className="text-slate-400">·</span>
						<span className="text-slate-600">
							{direction === 'AtoB' ? `${langA.name} → ${langB.name}` : `${langB.name} → ${langA.name}`}
						</span>
					</div>
				</div>
			</header>

			{/* Conversation history (newest at the bottom) */}
			<main className="flex-1 px-5 pb-4 pt-5">
				<div className="mx-auto w-full max-w-lg space-y-3">
					{history.length === 0 && state !== STATES.TRANSLATING && !error && (
						<div className="rounded-2xl border border-dashed border-slate-200 bg-white px-5 py-10 text-center">
							<p className="text-sm text-slate-500">
								Press the microphone button for the direction you want to speak. The app records
								one utterance, translates it into the other language and reads it aloud (if
								auto-read is on). Then it waits for your next button press — it never switches
								direction on its own.
							</p>
						</div>
					)}

					{hiddenCount > 0 && (
						<p className="text-center text-xs text-slate-400">
							{hiddenCount} earlier {hiddenCount === 1 ? 'turn' : 'turns'} hidden
						</p>
					)}

					{renderedHistory.map((entry) => (
						<TurnCard key={entry.id} entry={entry} langA={langA} langB={langB} />
					))}

					{state === STATES.TRANSLATING && (
						<div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-medium text-slate-500">
							<Loader2 className="h-4 w-4 animate-spin text-[#1976D2]" />
							Translating {direction === 'AtoB' ? `${langA.name} → ${langB.name}` : `${langB.name} → ${langA.name}`} …
						</div>
					)}

					{error && (
						<div className="flex flex-col gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
							<div className="flex items-start gap-2">
								<AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
								<span className="flex-1">{error.message}</span>
								<button
									onClick={handleDismissError}
									className="text-amber-500 hover:text-amber-700"
									aria-label="Fehlermeldung schließen"
								>
									<X className="h-4 w-4" />
								</button>
							</div>
							<div className="flex flex-wrap gap-2">
								<button
									onClick={handleRetry}
									className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-amber-700 active:scale-[0.98]"
								>
									<RotateCw className="h-4 w-4" /> Try again
								</button>
								<button
									onClick={() => engineRef.current?.switchDirection()}
									className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-amber-300 px-4 py-2 text-sm font-semibold text-amber-800 transition-colors hover:bg-amber-100 active:scale-[0.98]"
								>
									Switch direction
								</button>
							</div>
						</div>
					)}

					<div ref={bottomRef} />
				</div>
			</main>

			{/* Input / control area */}
			<div className="sticky bottom-16 border-t border-slate-100 bg-white px-5 pb-5 pt-4 md:bottom-0">
				<div className="mx-auto w-full max-w-lg">
					{/* Two clearly labeled direction mic buttons */}
					<div className="grid grid-cols-2 gap-3">
						<DirectionMicButton
							fromName={langA.name}
							toName={langB.name}
							accent="blue"
							isActive={direction === 'AtoB'}
							state={state}
							recognitionSupported={speechInputSupported}
							onPress={() => handleDirectionPress('AtoB')}
						/>
						<DirectionMicButton
							fromName={langB.name}
							toName={langA.name}
							accent="teal"
							isActive={direction === 'BtoA'}
							state={state}
							recognitionSupported={speechInputSupported}
							onPress={() => handleDirectionPress('BtoA')}
						/>
					</div>

					<p className="mt-3 text-center text-sm font-semibold text-slate-700">{statusText}</p>

					<button
						type="button"
						aria-pressed={nearbySpeakerMode}
						onClick={() => setNearbySpeakerMode((value) => !value)}
						disabled={isBusy || !audioCaptureSupported}
						className={`mx-auto mt-3 flex items-center justify-center gap-1.5 rounded-full border px-4 py-2 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
							nearbySpeakerMode
								? 'border-teal-500 bg-teal-50 text-teal-700'
								: 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
						}`}
					>
						<Volume2 className="h-3.5 w-3.5" />
						Nearby speaker audio
					</button>

					{state === STATES.SPEAKING && (
						<button
							onClick={handleStopSpeaking}
							className="mx-auto mt-3 flex items-center justify-center gap-1.5 rounded-2xl bg-teal-500 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal-600 active:scale-[0.98]"
						>
							<StopCircle className="h-4 w-4" /> Stop reading
						</button>
					)}

					{!speechInputSupported && (
						<p className="mt-2 max-w-sm mx-auto text-center text-xs text-amber-700">
							Voice capture is not supported in this browser. Please use the text input below.
						</p>
					)}

					<p className="mt-2 flex items-start gap-1.5 text-center text-[11px] leading-snug text-slate-400">
						<ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
						Spoken content is processed only for transcription and translation. Audio is not
						permanently stored.
					</p>

					{/* Honeypot — invisible to real users */}
					<input
						ref={honeypotRef}
						type="text"
						name="_hp"
						autoComplete="off"
						tabIndex={-1}
						style={{ display: 'none' }}
						aria-hidden="true"
					/>

					{/* Text input fallback */}
					<div className="mt-4">
						<textarea
							value={textInput}
							onChange={(e) => setTextInput(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
									e.preventDefault();
									handleTextSubmit();
								}
							}}
							rows={2}
							disabled={!canSubmitText}
							placeholder={`Enter text in ${direction === 'AtoB' ? langA.name : langB.name} …`}
							className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-base text-slate-900 outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-200 disabled:opacity-50"
						/>
						<button
							onClick={handleTextSubmit}
							disabled={!textInput.trim() || !canSubmitText}
							className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-teal-500 px-6 py-3.5 text-base font-bold text-white transition-colors hover:bg-teal-600 disabled:cursor-not-allowed disabled:bg-slate-300"
						>
							<Send className="h-5 w-5" />
							Translate {direction === 'AtoB' ? `${langA.name} → ${langB.name}` : `${langB.name} → ${langA.name}`}
						</button>
					</div>

					{/* Dialog controls */}
					<div className="mt-4 grid grid-cols-2 gap-2">
						{state === STATES.PAUSED ? (
							<button
								onClick={handleResume}
								className="inline-flex items-center justify-center gap-1.5 rounded-2xl bg-[#1976D2] px-3 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#0B1F3A] active:scale-[0.98]"
							>
								<Play className="h-4 w-4" /> Resume
							</button>
						) : (
							<button
								onClick={handlePause}
								disabled={state === STATES.IDLE || state === STATES.ENDED || state === STATES.ERROR}
								className="inline-flex items-center justify-center gap-1.5 rounded-2xl border border-slate-200 px-3 py-3 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-40 active:scale-[0.98]"
							>
								<Pause className="h-4 w-4" /> Pause
							</button>
						)}
						<button
							onClick={() => setConfirmOpen(true)}
							className="inline-flex items-center justify-center gap-1.5 rounded-2xl border border-slate-200 px-3 py-3 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 active:scale-[0.98]"
						>
							<LogOut className="h-4 w-4" /> End dialog
						</button>
					</div>
				</div>
			</div>

			<AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>End dialog?</AlertDialogTitle>
						<AlertDialogDescription>
							Do you really want to end the current dialog? The conversation history will be deleted
							and you return to the language selection.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction onClick={confirmEnd} className="bg-[#1976D2] hover:bg-[#0B1F3A]">
							End dialog
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}

function StateBadge({ state }) {
	const map = {
		[STATES.LISTENING]: 'bg-teal-50 text-teal-600',
		[STATES.TRANSLATING]: 'bg-blue-50 text-blue-600',
		[STATES.SPEAKING]: 'bg-teal-50 text-teal-600',
		[STATES.AWAITING_TAP]: 'bg-amber-50 text-amber-600',
		[STATES.PAUSED]: 'bg-slate-100 text-slate-500',
		[STATES.ERROR]: 'bg-amber-100 text-amber-700',
		[STATES.IDLE]: 'bg-slate-100 text-slate-500',
		[STATES.ENDED]: 'bg-slate-100 text-slate-500',
	};
	return (
		<span className={`rounded-full px-2.5 py-0.5 ${map[state] || 'bg-slate-100 text-slate-500'}`}>
			{STATE_LABEL[state]}
		</span>
	);
}

// A single direction mic button. Shows the "{from} sprechen → {to}" label and
// reflects the current engine state: pulsing while listening in this direction,
// spinner while translating, disabled while the other direction is busy.
function DirectionMicButton({ fromName, toName, accent, isActive, state, recognitionSupported, onPress }) {
	const isListeningHere = isActive && state === STATES.LISTENING;
	const isTranslatingHere = isActive && state === STATES.TRANSLATING;
	const isSpeakingHere = isActive && state === STATES.SPEAKING;

	// Locked during any busy state (recording / translating / speaking), and
	// during errors / pause (those have their own controls).
	const locked =
		state === STATES.LISTENING ||
		state === STATES.TRANSLATING ||
		state === STATES.SPEAKING ||
		state === STATES.ERROR ||
		state === STATES.PAUSED ||
		state === STATES.IDLE ||
		state === STATES.ENDED;

	// The active direction's button stays enabled while listening so the user
	// can cancel the recording by pressing it again.
	const canCancelListening = isActive && state === STATES.LISTENING;
	const disabled = locked && !canCancelListening && state !== STATES.AWAITING_TAP;

	const accentClasses =
		accent === 'blue'
			? {
					active: 'bg-[#1976D2] text-white border-[#1976D2]',
					idle: 'border-slate-200 text-[#1976D2] bg-white hover:bg-blue-50',
				}
			: {
					active: 'bg-teal-500 text-white border-teal-500',
					idle: 'border-slate-200 text-teal-600 bg-white hover:bg-teal-50',
				};

	const surfaceClass = isListeningHere
		? accent === 'blue'
			? 'bg-[#1976D2] text-white border-[#1976D2] animate-mic-pulse'
			: 'bg-teal-500 text-white border-teal-500 animate-mic-pulse'
		: isTranslatingHere || isSpeakingHere
			? accentClasses.active
			: isActive
				? accentClasses.idle
				: 'border-slate-200 text-slate-500 bg-white hover:bg-slate-50';

	let icon;
	if (isListeningHere) {
		icon = <Mic className="h-7 w-7" />;
	} else if (isTranslatingHere) {
		icon = <Loader2 className="h-7 w-7 animate-spin" />;
	} else if (isSpeakingHere) {
		icon = <StopCircle className="h-7 w-7" />;
	} else {
		icon = <Mic className="h-7 w-7" />;
	}

	const label = `Speak ${fromName} → ${toName}`;

	return (
		<button
			type="button"
			onClick={onPress}
			disabled={disabled || !recognitionSupported}
			aria-label={label}
			className={`flex flex-col items-center justify-center gap-2 rounded-2xl border-2 px-3 py-5 text-center transition-colors active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 ${surfaceClass}`}
		>
			<span className="flex h-14 w-14 items-center justify-center rounded-full bg-black/5">
				{icon}
			</span>
			<span className="text-sm font-bold leading-tight">{label}</span>
		</button>
	);
}

function TurnCard({ entry, langA, langB }) {
	const [copied, setCopied] = useState(false);
	const fromLang = entry.direction === 'AtoB' ? langA : langB;
	const toLang = entry.direction === 'AtoB' ? langB : langA;
	const handleSpeak = () => {
		speak(entry.translation, entry.targetCode, { rateMultiplier: getSettings().rate });
	};
	const handleCopy = async () => {
		const ok = await copyTextToClipboard(entry.translation);
		setCopied(ok);
		if (ok) {
			setTimeout(() => setCopied(false), 1600);
		}
	};
	return (
		<div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
			<div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
				<p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
					{fromLang.name} · {entry.detectedLanguageName || 'detected'}
				</p>
				<p className="mt-1 whitespace-pre-wrap text-base text-slate-700 selection:bg-blue-100">
					{entry.original}
				</p>
			</div>
			<div className="px-4 py-4">
				<p className="text-[11px] font-semibold uppercase tracking-wide text-teal-500">
					{toLang.name}
				</p>
				<p className="mt-1 whitespace-pre-wrap text-lg font-semibold leading-snug text-slate-900 selection:bg-teal-100">
					{entry.translation}
				</p>
				<div className="mt-3 flex flex-wrap gap-2">
					<button
						onClick={handleSpeak}
						className="inline-flex items-center gap-1.5 rounded-full bg-[#1976D2] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#0B1F3A] active:scale-[0.98]"
					>
						<Volume2 className="h-4 w-4" /> Read aloud
					</button>
					<button
						onClick={handleCopy}
						className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 active:scale-[0.98]"
					>
						{copied ? <Check className="h-4 w-4 text-teal-500" /> : <Copy className="h-4 w-4" />}
						{copied ? 'Copied' : 'Copy'}
					</button>
				</div>
			</div>
		</div>
	);
}
