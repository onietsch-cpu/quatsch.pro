const TTS_MODEL = process.env.OPENAI_TTS_MODEL || 'tts-1';

// Map BCP-47 language codes to OpenAI TTS voices
// OpenAI TTS supports multiple languages per voice; 'alloy' is a neutral, clear default
const LANG_TO_VOICE = {
	'de': 'nova',
	'en': 'alloy',
	'fr': 'nova',
	'es': 'nova',
	'it': 'nova',
	'pt': 'nova',
	'pl': 'nova',
	'nl': 'nova',
	'ru': 'nova',
	'ar': 'nova',
	'zh': 'nova',
	'ja': 'nova',
	'ko': 'nova',
	'hi': 'nova',
	'tr': 'nova',
	'vi': 'nova',
};

function pickVoice(langCode) {
	if (!langCode) return 'alloy';
	const base = langCode.toLowerCase().split('-')[0];
	return LANG_TO_VOICE[base] || 'alloy';
}

// Supports both GET (query params, used by mobile for synchronous audio.play()) and POST (body)
export default async (req, res) => {
	const text = req.method === 'GET' ? req.query.text : req.body?.text;
	const langCode = req.method === 'GET' ? req.query.langCode : req.body?.langCode;

	if (!text || typeof text !== 'string' || text.trim().length === 0) {
		return res.status(422).json({ error: 'text is required' });
	}
	if (text.length > 4096) {
		return res.status(422).json({ error: 'text too long (max 4096 chars)' });
	}

	const apiUrl = process.env.INTEGRATED_AI_API_URL;
	const apiKey = process.env.INTEGRATED_AI_API_KEY;

	if (!apiUrl || !apiKey) {
		throw new Error('INTEGRATED_AI_API_URL or INTEGRATED_AI_API_KEY is not configured');
	}

	const ttsUrl = apiUrl.replace(/\/chat\/completions\/?$/, '/audio/speech');

	const upstream = await fetch(ttsUrl, {
		method: 'POST',
		headers: {
			'Authorization': `Bearer ${apiKey}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			model: TTS_MODEL,
			input: text.trim(),
			voice: pickVoice(langCode),
			response_format: 'mp3',
		}),
	});

	if (!upstream.ok) {
		throw new Error(`TTS upstream failed: ${upstream.status} ${upstream.statusText}`);
	}

	res.setHeader('Content-Type', 'audio/mpeg');
	res.setHeader('Cache-Control', 'no-store');

	const buffer = await upstream.arrayBuffer();
	res.send(Buffer.from(buffer));
};
