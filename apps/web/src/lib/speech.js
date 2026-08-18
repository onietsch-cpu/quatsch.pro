// Sprachausgabe (Web Speech Synthesis API) mit passender Stimmenauswahl.

let cachedVoices = [];

export function loadVoices() {
	if (typeof window === 'undefined' || !window.speechSynthesis) {
		return [];
	}
	cachedVoices = window.speechSynthesis.getVoices() || [];
	return cachedVoices;
}

export function onVoicesChanged(cb) {
	if (typeof window === 'undefined' || !window.speechSynthesis) {
		return () => {};
	}
	const handler = () => {
		loadVoices();
		cb(cachedVoices);
	};
	window.speechSynthesis.addEventListener('voiceschanged', handler);
	loadVoices();
	return () => window.speechSynthesis.removeEventListener('voiceschanged', handler);
}

// Namen, die typischerweise auf eine weichere, klare (meist weibliche) Stimme hindeuten –
// je nach Plattform/Browser unterschiedlich benannt.
const SOFT_VOICE_HINTS = [
	'female',
	weiblich_marker(),
	'samantha',
	'victoria',
	'karen',
	'moira',
	'tessa',
	'fiona',
	'anna',
	'petra',
	'helena',
	'hedda',
	'katja',
	'zira',
	'susan',
	'ava',
	'allison',
	'nicky',
	'salli',
	'joanna',
	'ines',
	'amelie',
	'google deutsch',
	'google us english',
	'google uk english female',
];

function weiblich_marker() {
	return 'weiblich';
}

// Namen, die auf eine markante/mechanisch wirkende männliche Stimme hindeuten – werden gemieden,
// solange eine weichere Alternative existiert.
const HARSH_VOICE_HINTS = ['male', 'männlich', 'stefan', 'yannick', 'markus', 'daniel', 'thomas', 'david', 'fred', 'alex'];

// Hinweise auf besonders natürlich klingende, hochwertige Sprachsynthese-Engines –
// diese liefern eine deutlich präzisere, der Sprache angemessenere Aussprache
// als generische/kompakte Systemstimmen.
const QUALITY_VOICE_HINTS = [
	'natural',
	'neural',
	'enhanced',
	'premium',
	'wavenet',
	'online',
	'google',
	'microsoft',
	'siri',
];

// Sprachen mit komplexerer Phonetik (Tonsprachen, Tonhöhenakzente, ungewohnte
// Lautbilder für TTS-Engines) profitieren von etwas langsamerem, klar
// artikuliertem Vortrag statt der Standardgeschwindigkeit.
const SLOW_SPEECH_BASE_CODES = new Set([
	'zh', 'yue', 'ja', 'ko', 'th', 'vi', 'km', 'lo', 'my',
	'ar', 'he', 'fa', 'ur', 'hi', 'bn', 'ta', 'te', 'mr', 'gu', 'pa', 'ml', 'kn', 'si', 'ne',
	'ka', 'hy', 'am',
]);

// Liefert eine der jeweiligen Sprache angemessene Sprechgeschwindigkeit/Tonhöhe,
// statt pauschal einen Wert für alle Sprachen zu verwenden.
function getProsodyForLang(langCode) {
	const base = (langCode || '').toLowerCase().split('-')[0];
	if (SLOW_SPEECH_BASE_CODES.has(base)) {
		return { rate: 0.85, pitch: 1.03 };
	}
	return { rate: 0.95, pitch: 1.05 };
}

function scoreVoice(voice, langCode) {
	const name = (voice.name || '').toLowerCase();
	const lower = (langCode || '').toLowerCase();
	let score = 1;

	// Eine exakte Locale-Übereinstimmung (z. B. "pt-BR" statt nur "pt") liefert
	// die für die Region korrekte Aussprache und wird bevorzugt.
	if (voice.lang && voice.lang.toLowerCase() === lower) {
		score += 2;
	}
	if (QUALITY_VOICE_HINTS.some((hint) => name.includes(hint))) {
		score += 3;
	}
	if (voice.localService === false) {
		// Netzwerkbasierte Stimmen sind bei den meisten Browsern die
		// natürlicher klingenden, serverseitig gerenderten Varianten.
		score += 1;
	}
	if (SOFT_VOICE_HINTS.some((hint) => name.includes(hint))) {
		score += 2;
	}
	if (HARSH_VOICE_HINTS.some((hint) => name.includes(hint))) {
		score -= 1;
	}
	return score;
}

function pickSoftest(matches, langCode) {
	if (!matches.length) {
		return null;
	}
	return [...matches].sort((a, b) => scoreVoice(b, langCode) - scoreVoice(a, langCode))[0];
}

export function findVoice(langCode) {
	const voices = cachedVoices.length ? cachedVoices : loadVoices();
	if (!voices.length) {
		return null;
	}
	const lower = langCode.toLowerCase();
	const base = lower.split('-')[0];

	const exact = voices.filter((v) => v.lang && v.lang.toLowerCase() === lower);
	const regional = voices.filter((v) => v.lang && v.lang.toLowerCase().startsWith(base + '-'));
	const byBase = voices.filter((v) => v.lang && v.lang.toLowerCase().split('-')[0] === base);

	return pickSoftest(exact, lower) || pickSoftest(regional, lower) || pickSoftest(byBase, lower) || null;
}

let currentAudio = null;

export function stopSpeaking() {
	if (typeof window !== 'undefined' && window.speechSynthesis) {
		window.speechSynthesis.cancel();
	}
	if (currentAudio) {
		currentAudio.pause();
		currentAudio.src = '';
		currentAudio = null;
	}
}

// Fallback: spielt Text über OpenAI TTS-API ab, wenn keine Browser-Stimme verfügbar.
// Uses GET so audio.play() is called SYNCHRONOUSLY within the user gesture context —
// required for iOS Safari which blocks async-deferred play() calls.
function speakViaApi(text, langCode, { onStart, onEnd, onError } = {}) {
	try {
		const params = new URLSearchParams({ text: text.trim(), langCode: langCode || '' });
		const audio = new Audio(`/hcgi/api/tts?${params}`);
		currentAudio = audio;

		audio.oncanplaythrough = () => {
			onStart && onStart();
		};
		audio.onended = () => {
			currentAudio = null;
			onEnd && onEnd();
		};
		audio.onerror = () => {
			currentAudio = null;
			onError && onError('api-tts-failed');
			onEnd && onEnd();
		};

		// Call play() synchronously here — preserves iOS gesture context.
		const playPromise = audio.play();
		if (playPromise !== undefined) {
			playPromise.catch(() => {
				// Autoplay blocked (e.g. auto-read without gesture) — silently ignore
				currentAudio = null;
				onEnd && onEnd();
			});
		}
	} catch {
		onError && onError('api-tts-failed');
		onEnd && onEnd();
	}
}

// Gibt den Text aus.
// Wichtig auf Mobilgeräten: Browser-Stimmen (getVoices) werden asynchron geladen
// und sind beim ersten Aufruf oft noch leer. Deshalb wird IMMER die native
// speechSynthesis verwendet, sobald sie existiert – auch wenn findVoice() (noch)
// keine spezifische Stimme liefert. In dem Fall setzen wir nur utterance.lang und
// lassen den Browser selbst eine passende Standardstimme wählen. Nur wenn
// speechSynthesis komplett fehlt, greift der API-Fallback.
export function speak(text, langCode, { onStart, onEnd, onError, rateMultiplier = 1 } = {}) {
	if (typeof window === 'undefined') {
		onError && onError('no-synthesis');
		return;
	}

	if (!window.speechSynthesis) {
		speakViaApi(text, langCode, { onStart, onEnd, onError });
		return;
	}

	// Sicherstellen, dass die Stimmenliste angefordert wurde (mobile Browser laden lazy).
	if (!cachedVoices.length) {
		loadVoices();
	}

	const voice = findVoice(langCode);

	window.speechSynthesis.cancel();

	// One-shot guard: ensure onEnd/onError fire at most once per call, even if
	// the browser dispatches both events (a known quirk on some mobile WebViews).
	let settled = false;
	const safeOnStart = () => {
		if (settled) return;
		onStart && onStart();
	};
	const safeOnEnd = () => {
		if (settled) return;
		settled = true;
		onEnd && onEnd();
	};
	const safeOnError = (info) => {
		if (settled) return;
		settled = true;
		onError && onError(info);
	};

	const utterance = new SpeechSynthesisUtterance(text);
	if (voice) {
		utterance.voice = voice;
	}
	utterance.lang = (voice && voice.lang) || langCode;
	// Sprachspezifisches Tempo/Tonhöhe: komplexere Phonetik (Ton-/Akzentsprachen)
	// wird etwas langsamer und klarer gesprochen für eine der Sprache
	// angemessenere, verständlichere Aussprache statt eines pauschalen Werts.
	const { rate, pitch } = getProsodyForLang(utterance.lang);
	utterance.rate = rate * rateMultiplier;
	utterance.pitch = pitch;
	utterance.onstart = () => safeOnStart();
	utterance.onend = () => safeOnEnd();
	utterance.onerror = (event) => {
		// Wenn die native Synthese scheitert (manche Android-WebViews), API-Fallback versuchen.
		if (event && event.error && event.error !== 'canceled' && event.error !== 'interrupted') {
			speakViaApi(text, langCode, {
				onStart: safeOnStart,
				onEnd: safeOnEnd,
				onError: safeOnError,
			});
			return;
		}
		safeOnEnd();
	};

	// iOS Safari: resume() falls die Queue pausiert ist, sonst bleibt speak() stumm.
	try {
		window.speechSynthesis.resume();
	} catch {
		/* noop */
	}
	window.speechSynthesis.speak(utterance);
}

export function isSpeechRecognitionSupported() {
	return typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);
}
