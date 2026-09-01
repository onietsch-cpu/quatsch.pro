import { transcribeAudio } from '../services/ai-provider.js';

const MAX_AUDIO_BYTES = 10 * 1024 * 1024;
const AUDIO_DATA_URL_RE = /^data:(audio\/[a-z0-9.+-]+(?:;codecs=[a-z0-9.+-]+)?);base64,([a-z0-9+/=\s]+)$/i;

function normalizeLanguageHint(value) {
	const code = String(value || '').trim().toLowerCase().split(/[-_]/)[0];
	return /^[a-z]{2,3}$/.test(code) ? code : '';
}

export function parseAudioDataUrl(value) {
	const match = String(value || '').match(AUDIO_DATA_URL_RE);
	if (!match) {
		return null;
	}

	const mimeType = match[1].toLowerCase();
	const base64 = match[2].replace(/\s+/g, '');
	const buffer = Buffer.from(base64, 'base64');
	if (!buffer.length || buffer.length > MAX_AUDIO_BYTES) {
		return null;
	}

	return { buffer, mimeType };
}

export default async (req, res) => {
	const { audioDataUrl, sourceLanguageCode } = req.body || {};
	const parsed = parseAudioDataUrl(audioDataUrl);

	if (!parsed) {
		return res.status(422).json({ error: 'A valid audio recording is required.' });
	}
	if (sourceLanguageCode !== undefined && typeof sourceLanguageCode !== 'string') {
		return res.status(422).json({ error: 'Source language code is invalid.' });
	}

	const text = await transcribeAudio({
		audioBuffer: parsed.buffer,
		mimeType: parsed.mimeType,
		language: normalizeLanguageHint(sourceLanguageCode),
	});

	if (!text) {
		return res.status(422).json({ error: 'No speech could be transcribed.' });
	}

	res.json({ text });
};
