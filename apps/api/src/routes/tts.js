import { generateSpeech } from '../services/ai-provider.js';

const LANG_TO_VOICE = { de: 'nova', en: 'alloy', fr: 'nova', es: 'nova', it: 'nova' };

function pickVoice(langCode) {
	const base = String(langCode || '').toLowerCase().split('-')[0];
	return LANG_TO_VOICE[base] || 'alloy';
}

export default async (req, res) => {
	const text = req.method === 'GET' ? req.query.text : req.body?.text;
	const langCode = req.method === 'GET' ? req.query.langCode : req.body?.langCode;

	if (!text || typeof text !== 'string' || !text.trim()) {
		return res.status(422).json({ error: 'text is required' });
	}
	if (text.length > 4096) {
		return res.status(422).json({ error: 'text too long (max 4096 chars)' });
	}

	const upstream = await generateSpeech({ text: text.trim(), voice: pickVoice(langCode) });
	res.setHeader('Content-Type', 'audio/mpeg');
	res.setHeader('Cache-Control', 'private, no-store');
	res.send(Buffer.from(await upstream.arrayBuffer()));
};
