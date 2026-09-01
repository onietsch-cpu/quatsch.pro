import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
	Mic,
	Loader2,
	Send,
	ShieldCheck,
	AlertTriangle,
	LogOut,
	X,
	ArrowRightLeft,
	ImageIcon,
	Search,
	Check,
	RotateCw,
	ChevronDown,
} from 'lucide-react';
import PhotoTranslator from '@/components/PhotoTranslator';
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
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import TranslationCard from '@/components/TranslationCard';
import { LANGUAGES, QUICK_CODES, getLanguageByCode } from '@/lib/languages';
import { translateText } from '@/lib/translateClient';
import { addHistoryEntry, getSettings } from '@/lib/storage';
import {
	speak,
	stopSpeaking,
	loadVoices,
	onVoicesChanged,
	isSpeechRecognitionSupported,
	createTimedSpeechRecognition,
	SPEECH_INPUT_MAX_DURATION_MS,
} from '@/lib/speech';

export default function DialogView({ mode, targetCode, langACode, langBCode, onEndDialog }) {
	const isDialogMode = mode === 'dialog';

	const langA = isDialogMode ? getLanguageByCode(langACode) : null;
	const langB = isDialogMode ? getLanguageByCode(langBCode) : null;

	// Im Single-Modus wird die Zielsprache lokal gehalten, damit sie während
	// des Dialogs geändert werden kann (ohne die Session neu zu starten).
	const [activeTargetCode, setActiveTargetCode] = useState(targetCode);
	const singleTarget = !isDialogMode ? getLanguageByCode(activeTargetCode) : null;

	// Im Dialogmodus: 'AtoB' heißt, Sprecher A ist dran und wird nach B übersetzt (und umgekehrt).
	const [direction, setDirection] = useState('AtoB');

	const destination = isDialogMode
		? direction === 'AtoB'
			? langB
			: langA
		: singleTarget;
	const speaker = isDialogMode ? (direction === 'AtoB' ? langA : langB) : null;

	// Es wird ausschließlich das Ergebnis der jeweils neuesten Eingabe angezeigt.
	const [currentResult, setCurrentResult] = useState(null);
	const [textInput, setTextInput] = useState('');
	const [isTranslating, setIsTranslating] = useState(false);
	const [isListening, setIsListening] = useState(false);
	// Fehler speichert die zugehörige Eingabe, damit sie erneut ausgeführt werden kann.
	const [error, setError] = useState(null);
	const [confirmOpen, setConfirmOpen] = useState(false);
	const [langPickerOpen, setLangPickerOpen] = useState(false);
	const [recognitionSupported] = useState(() => Boolean(isSpeechRecognitionSupported()));
	const [settings, setSettings] = useState(() => getSettings());
	const [inputTab, setInputTab] = useState('speak'); // 'speak' | 'photo'

	// Race-Condition-Schutz: jede Übersetzung bekommt eine aufsteigende ID.
	// Nur das Ergebnis der aktuell neuesten ID darf das angezeigte Ergebnis überschreiben.
	const requestIdRef = useRef(0);
	// Die zuletzt übergebene Eingabe (für Retry und Neuübersetzung bei Sprachwechsel).
	const lastInputRef = useRef('');

	const recognitionRef = useRef(null);
	const bottomRef = useRef(null);
	const textHoneypotRef = useRef(null);

	useEffect(() => {
		const onFocus = () => setSettings(getSettings());
		window.addEventListener('focus', onFocus);
		return () => window.removeEventListener('focus', onFocus);
	}, []);

	useEffect(() => {
		loadVoices();
		const off = onVoicesChanged(() => {});
		return off;
	}, []);

	useEffect(() => {
		bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
	}, [currentResult, isTranslating, error]);

	const handleSpeak = useCallback(
		(entry) => {
			if (isListening) return;
			const voiceCode = entry.destinationCode || activeTargetCode;
			speak(entry.translation, voiceCode, {
				rateMultiplier: settings.rate,
			});
		},
		[activeTargetCode, isListening, settings.rate],
	);

	const toggleDirection = useCallback(() => {
		if (!isDialogMode) return;
		stopSpeaking();
		setDirection((prev) => (prev === 'AtoB' ? 'BtoA' : 'AtoB'));
	}, [isDialogMode]);

	// Zentrale Übersetzungsroutine. Jeder Aufruf startet den Vorgang vollständig neu,
	// verwirft ältere laufende Anfragen und zeigt nur das Ergebnis dieser ID an.
	const runTranslation = useCallback(
		async (text, opts = {}) => {
			const trimmed = (text || '').trim();
			if (!trimmed) return;

			const dest = opts.dest || destination;
			if (!dest) return;

			if (typeof navigator !== 'undefined' && navigator.onLine === false) {
				setCurrentResult(null);
				setError({
					message: 'You are offline. An internet connection is required for new translations.',
					input: trimmed,
				});
				return;
			}

			// Neue Anfrage → alte Anfragen verwerfen.
			const myId = (requestIdRef.current += 1);
			lastInputRef.current = trimmed;

			setIsTranslating(true);
			setError(null);
			setCurrentResult(null);
			stopSpeaking();

			try {
				const result = await translateText({
					text: trimmed,
					targetLanguageName: dest.name,
					targetLanguageCode: dest.code,
					honeypot: textHoneypotRef.current?.value ?? '',
				});

				// Veraltete Antwort verwerfen – niemals neuere Ergebnisse überschreiben.
				if (requestIdRef.current !== myId) return;

				const entry = {
					id: Date.now() + Math.random(),
					original: trimmed,
					translation: result.translation,
					detectedLanguageName: result.detectedLanguageName,
					destinationCode: dest.code,
				};

				setCurrentResult(entry);

				if (settings.saveHistory) {
					addHistoryEntry({
						original: entry.original,
						translation: entry.translation,
						detectedLanguageName: entry.detectedLanguageName,
						targetName: dest.name,
					});
				}

				// Automatisches Vorlesen, sofern in den Einstellungen aktiviert.
				if (settings.autoRead) {
					speak(entry.translation, dest.code, {
						rateMultiplier: settings.rate,
					});
				}

				// Im Dialogmodus wechselt nach jeder Übersetzung automatisch die Sprechrichtung.
				if (isDialogMode) {
					setDirection((prev) => (prev === 'AtoB' ? 'BtoA' : 'AtoB'));
				}
			} catch (err) {
				if (requestIdRef.current !== myId) return;
				let message;
				if (err.code === 'offline') {
					message = 'No internet connection. Please check your connection and try again.';
				} else if (err.code === 'api') {
					message = 'The translation service is currently unavailable. Please try again later.';
				} else {
					message = 'The translation failed. Please try again.';
				}
				setError({ message, input: trimmed });
			} finally {
				if (requestIdRef.current === myId) {
					setIsTranslating(false);
				}
			}
		},
		[destination, isDialogMode, settings],
	);

	const handleTextSubmit = useCallback(() => {
		// In dialog mode a new input may only start once the previous
		// translation finished and the speaking direction switched,
		// otherwise it translates into the wrong language.
		if (isDialogMode && isTranslating) return;
		const value = textInput.trim();
		if (!value) return;
		if (value.length > 5000) {
			setError({ message: 'Text must not exceed 5,000 characters.', input: value });
			return;
		}
		setTextInput('');
		runTranslation(value);
	}, [textInput, runTranslation, isDialogMode, isTranslating]);

	// Letzte fehlgeschlagene Eingabe erneut ausführen (ohne ältere Inhalte zu verwenden).
	const handleRetry = useCallback(() => {
		const input = error?.input;
		if (!input) return;
		runTranslation(input);
	}, [error, runTranslation]);

	const stopListening = useCallback(() => {
		if (recognitionRef.current) {
			try {
				recognitionRef.current.stop();
			} catch {
				/* noop */
			}
		}
		setIsListening(false);
	}, []);

	const startListening = useCallback(() => {
		if (!recognitionSupported) return;

		if (isListening) {
			stopListening();
			return;
		}

		// Laufende Audioausgabe stoppen, bevor die Aufnahme beginnt.
		stopSpeaking();
		setError(null);

		// In dialog mode use the current speaker's language code for accurate transcription.
		// In single mode leave it empty so the browser auto-detects the source language.
		const recognition = createTimedSpeechRecognition({
			langCode: isDialogMode && speaker ? speaker.code : '',
			maxDurationMs: SPEECH_INPUT_MAX_DURATION_MS,
			onResult: (spoken) => {
				runTranslation(spoken);
			},
			onError: (event) => {
				setIsListening(false);
				if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
					setError({
						message: 'Microphone access was not granted. Please allow microphone access or use text input.',
						input: '',
					});
				} else if (event.error === 'no-speech') {
					setError({
						message: 'Nothing could be understood. Please speak more clearly or use text input.',
						input: '',
					});
				} else if (event.error === 'network') {
					setError({
						message: 'No internet connection for speech recognition. Please check your connection.',
						input: '',
					});
				} else if (event.error !== 'aborted') {
					setError({ message: 'Speech recognition failed. Please use text input.', input: '' });
				}
			},
			onEnd: () => {
				setIsListening(false);
				recognitionRef.current = null;
			},
		});

		recognitionRef.current = recognition;
		if (recognition.started) {
			setIsListening(true);
		} else {
			recognitionRef.current = null;
			setIsListening(false);
			setError({ message: 'Speech recognition could not be started. Please use text input.', input: '' });
		}
	}, [recognitionSupported, isListening, stopListening, runTranslation, isDialogMode, speaker]);

	// Zielsprache im Single-Modus ändern → aktuelle Eingabe sofort erneut übersetzen.
	const handleTargetChange = useCallback(
		(code) => {
			setLangPickerOpen(false);
			if (!code || code === activeTargetCode) return;
			const dest = getLanguageByCode(code);
			if (!dest) return;
			setActiveTargetCode(code);
			// Aktuell vorliegende Eingabe in die neu ausgewählte Sprache übersetzen.
			if (lastInputRef.current) {
				runTranslation(lastInputRef.current, { dest });
			}
		},
		[activeTargetCode, runTranslation],
	);

	const confirmEndDialog = useCallback(() => {
		stopSpeaking();
		stopListening();
		setConfirmOpen(false);
		onEndDialog();
	}, [stopListening, onEndDialog]);

	const headerTitle = isDialogMode ? 'Dialog Mode' : 'Translation to';

	const quickLangs = useMemo(
		() => QUICK_CODES.map(getLanguageByCode).filter(Boolean),
		[],
	);
	const [langQuery, setLangQuery] = useState('');
	const filteredLangs = useMemo(() => {
		const q = langQuery.trim().toLowerCase();
		if (!q) return LANGUAGES;
		return LANGUAGES.filter(
			(l) =>
				l.name.toLowerCase().includes(q) ||
				l.native.toLowerCase().includes(q) ||
				l.code.toLowerCase().includes(q),
		);
	}, [langQuery]);

	return (
		<div className="flex min-h-[100dvh] flex-col bg-slate-50">
			{/* Kopfzeile mit dauerhafter Zielsprache bzw. Dialogrichtung */}
			<header className="sticky top-0 z-10 border-b border-slate-100 bg-white/95 backdrop-blur">
				<div className="mx-auto w-full max-w-lg px-5 py-3">
					{!isDialogMode ? (
						<div className="flex items-center justify-between">
							<div>
								<p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
									{headerTitle}
								</p>
								<button
									onClick={() => setLangPickerOpen(true)}
									className="mt-0.5 inline-flex items-center gap-1 text-lg font-extrabold text-slate-900 transition-colors hover:text-[#1976D2] active:scale-[0.98]"
									aria-label="Zielsprache ändern"
								>
									{singleTarget?.name}
									<ChevronDown className="h-4 w-4 text-slate-400" />
								</button>
							</div>
							<span className="rounded-full bg-teal-50 px-3 py-1 text-sm font-semibold text-teal-600">
								{singleTarget?.native}
							</span>
						</div>
					) : (
						<div>
							<p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
								{headerTitle} · alternating translation
							</p>
							<div className="mt-1 flex items-center justify-between gap-2">
								<span
									className={`flex-1 rounded-xl px-3 py-2 text-center text-sm font-bold transition-colors ${
										direction === 'AtoB'
											? 'bg-[#1976D2] text-white'
											: 'bg-slate-100 text-slate-500'
									}`}
								>
									{langA.name}
								</span>
								<button
									onClick={toggleDirection}
									aria-label="Sprechrichtung wechseln"
									className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50 active:scale-95"
								>
									<ArrowRightLeft className="h-4 w-4" />
								</button>
								<span
									className={`flex-1 rounded-xl px-3 py-2 text-center text-sm font-bold transition-colors ${
										direction === 'BtoA'
											? 'bg-teal-500 text-white'
											: 'bg-slate-100 text-slate-500'
									}`}
								>
									{langB.name}
								</span>
							</div>
						</div>
					)}
				</div>
			</header>

			{/* Verlauf – nur das jeweils neueste Ergebnis */}
			<main className="flex-1 px-5 pb-4 pt-5">
				<div className="mx-auto w-full max-w-lg space-y-3">
					{!currentResult && !isTranslating && !error && (
						<div className="rounded-2xl border border-dashed border-slate-200 bg-white px-5 py-10 text-center">
							<p className="text-sm text-slate-500">
								{isDialogMode
									? `Let's go: first one person speaks in ${langA.name}, then it is automatically translated into ${langB.name} – and vice versa.`
									: 'Tap the microphone or enter text below to start your first translation.'}
							</p>
						</div>
					)}

					{currentResult && !isTranslating && (
						<TranslationCard
							key={currentResult.id}
							entry={currentResult}
							targetName={getLanguageByCode(currentResult.destinationCode)?.name || destination?.name}
							onSpeak={handleSpeak}
						/>
					)}

					{isTranslating && (
						<div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-medium text-slate-500">
							<Loader2 className="h-4 w-4 animate-spin text-[#1976D2]" />
							Translating …
						</div>
					)}

					{error && (
						<div className="flex flex-col gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
							<div className="flex items-start gap-2">
								<AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
								<span className="flex-1">{error.message}</span>
								<button onClick={() => setError(null)} className="text-amber-500 hover:text-amber-700">
									<X className="h-4 w-4" />
								</button>
							</div>
							{error.input && (
								<button
									onClick={handleRetry}
									className="inline-flex items-center justify-center gap-1.5 self-start rounded-xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-amber-700 active:scale-[0.98]"
								>
									<RotateCw className="h-4 w-4" />
									Try again
								</button>
							)}
						</div>
					)}

					<div ref={bottomRef} />
				</div>
			</main>

			{/* Eingabebereich */}
			<div className="sticky bottom-0 border-t border-slate-100 bg-white px-5 pb-5 pt-4">
				<div className="mx-auto w-full max-w-lg">
					{/* Tab switcher (single mode only) */}
					{!isDialogMode && (
						<div className="mb-4 grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
							<button
								onClick={() => setInputTab('speak')}
								className={`flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
									inputTab === 'speak'
										? 'bg-white text-slate-900 shadow-sm'
										: 'text-slate-500 hover:text-slate-700'
								}`}
							>
								<Mic className="h-4 w-4" /> Speak / Text
							</button>
							<button
								onClick={() => setInputTab('photo')}
								className={`flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
									inputTab === 'photo'
										? 'bg-white text-slate-900 shadow-sm'
										: 'text-slate-500 hover:text-slate-700'
								}`}
							>
								<ImageIcon className="h-4 w-4" /> Photo
							</button>
						</div>
					)}

					{/* Photo translator panel */}
					{!isDialogMode && inputTab === 'photo' && (
						<div className="mb-4">
							<PhotoTranslator
								targetCode={activeTargetCode}
								targetName={singleTarget?.name}
								settings={settings}
							/>
						</div>
					)}

					{/* Spracheingabe */}
					{(isDialogMode || inputTab === 'speak') && (
					<>
					<div className="flex flex-col items-center">
						<button
							onClick={startListening}
							disabled={!recognitionSupported || (isDialogMode && isTranslating)}
							className={`flex h-20 w-20 items-center justify-center rounded-full text-white transition-colors disabled:cursor-not-allowed disabled:bg-slate-300 ${
								isListening
									? 'animate-mic-pulse bg-teal-500'
									: 'bg-[#1976D2] hover:bg-[#0B1F3A]'
							}`}
							aria-label="Zum Sprechen tippen"
						>
							<Mic className="h-9 w-9" />
						</button>
						<p className="mt-2 text-sm font-semibold text-slate-700">
							{isListening
								? 'Listening — up to 60 seconds …'
								: isDialogMode && isTranslating
								? 'Translating — please wait for your turn …'
								: isDialogMode
								? `Now speaking: ${speaker.name} → translated into ${destination.name}`
								: 'Tap to speak'}
						</p>

						{!recognitionSupported && (
							<p className="mt-2 max-w-sm text-center text-xs text-amber-700">
								Speech recognition is not supported in this browser. Please use the text input below.
							</p>
						)}

						<p className="mt-2 flex items-start gap-1.5 text-center text-[11px] leading-snug text-slate-400">
							<ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
							Spoken content is processed exclusively for transcription and translation. Audio recordings are not permanently stored.
						</p>
					</div>

					{/* Honeypot — invisible to real users */}
					<input
						ref={textHoneypotRef}
						type="text"
						name="_hp"
						autoComplete="off"
						tabIndex={-1}
						style={{ display: 'none' }}
						aria-hidden="true"
					/>

					{/* Texteingabe */}
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
							placeholder={
								isDialogMode
									? `Enter text in ${speaker.name} …`
									: 'Enter or dictate text …'
							}
							className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-base text-slate-900 outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-200"
						/>
						<button
							onClick={handleTextSubmit}
							disabled={!textInput.trim() || (isDialogMode && isTranslating)}
							className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-teal-500 px-6 py-3.5 text-base font-bold text-white transition-colors hover:bg-teal-600 disabled:cursor-not-allowed disabled:bg-slate-300"
						>
							{isTranslating ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
							Translate
						</button>
					</div>

					<button
						onClick={() => setConfirmOpen(true)}
						className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 px-6 py-3 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50"
					>
						<LogOut className="h-4 w-4" />
						End dialog and choose language again
					</button>
					</>
					)}

					{/* End dialog button for photo tab */}
					{!isDialogMode && inputTab === 'photo' && (
					<button
						onClick={() => setConfirmOpen(true)}
						className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 px-6 py-3 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50"
					>
						<LogOut className="h-4 w-4" />
						End dialog and choose language again
					</button>
					)}
				</div>
			</div>

			<AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>End dialog?</AlertDialogTitle>
						<AlertDialogDescription>
							Do you really want to end the current dialog? The existing history will be deleted.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							onClick={confirmEndDialog}
							className="bg-[#1976D2] hover:bg-[#0B1F3A]"
						>
							End dialog
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			{/* Zielsprache im Single-Modus ändern */}
			<Dialog open={langPickerOpen} onOpenChange={setLangPickerOpen}>
				<DialogContent className="max-w-lg">
					<DialogHeader>
						<DialogTitle>Change target language</DialogTitle>
					</DialogHeader>
					<div className="relative">
						<Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
						<Input
							value={langQuery}
							onChange={(e) => setLangQuery(e.target.value)}
							placeholder="Search language …"
							className="pl-9"
						/>
					</div>
					{!langQuery && (
						<div className="flex flex-wrap gap-2">
							{quickLangs.map((l) => (
								<button
									key={l.code}
									onClick={() => handleTargetChange(l.code)}
									className={`rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors ${
										l.code === activeTargetCode
											? 'border-teal-500 bg-teal-500 text-white'
											: 'border-slate-200 bg-white text-slate-700 hover:border-teal-300'
									}`}
								>
									{l.name}
								</button>
							))}
						</div>
					)}
					<ScrollArea className="max-h-[50vh] pr-2">
						<div className="space-y-1.5">
							{filteredLangs.length === 0 && (
								<p className="py-6 text-center text-sm text-slate-400">No language found.</p>
							)}
							{filteredLangs.map((l) => {
								const active = l.code === activeTargetCode;
								return (
									<button
										key={l.code}
										onClick={() => handleTargetChange(l.code)}
										className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition-colors ${
											active
												? 'border-teal-500 bg-teal-50'
												: 'border-slate-200 bg-white hover:border-slate-300'
										}`}
									>
										<span>
											<span className="block text-sm font-semibold text-slate-900">{l.name}</span>
											{l.native !== l.name && (
												<span className="block text-xs text-slate-500">{l.native}</span>
											)}
										</span>
										{active && (
											<span className="flex h-6 w-6 items-center justify-center rounded-full bg-teal-500 text-white">
												<Check className="h-3.5 w-3.5" />
											</span>
										)}
									</button>
								);
							})}
						</div>
					</ScrollArea>
				</DialogContent>
			</Dialog>
		</div>
	);
}
