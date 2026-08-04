import { NodeEnv } from '../constants/common.js';
import logger from '../utils/logger.js';

const MAX_TEXT_LENGTH = 5000;

const SYSTEM_PROMPT = `You are a precise, professional translation engine. Your ONLY job is to translate text into the requested target language.

Rules:
1. Detect the language of the source text automatically.
2. Translate the ENTIRE source text faithfully and naturally into the TARGET language specified by the user. The output "translation" field MUST be written in that exact target language — never in the source language, never in any other language.
3. If the source text is already in the target language, still output it in the "translation" field unchanged.
4. Respond with ONLY a compact JSON object — no markdown, no code fences, no extra text.

Exact response shape:
{"detectedLanguageName":"<name of the detected source language in English>","detectedLanguageCode":"<BCP-47 code like en, de, vi>","translation":"<the translated text written entirely in the target language>"}

Do not add explanations. Do not wrap the JSON in backticks.`;

async function collectContent(response) {
	let content = '';
	let buffer = '';
	const textStream = response.body.pipeThrough(new TextDecoderStream());

	for await (const chunk of textStream) {
		buffer += chunk;
		const lines = buffer.split('\n');
		buffer = lines.pop() || '';

		for (const line of lines) {
			if (!line.startsWith('data: ')) {
				continue;
			}

			const jsonStr = line.slice(6).trim();

			if (!jsonStr || jsonStr === '[DONE]') {
				continue;
			}

			let event;
			try {
				event = JSON.parse(jsonStr);
			} catch {
				continue;
			}

			if (event.type === 'error') {
				throw new Error(event.data?.content || 'AI translation error');
			}

			if (event.type === 'content' && event.data?.content) {
				content += event.data.content;
			}
		}
	}

	return content;
}

function parseResult(raw) {
	let text = raw.trim();

	const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
	if (fenceMatch) {
		text = fenceMatch[1].trim();
	}

	const start = text.indexOf('{');
	const end = text.lastIndexOf('}');

	if (start !== -1 && end !== -1 && end > start) {
		try {
			return JSON.parse(text.slice(start, end + 1));
		} catch {
			// fall through
		}
	}

	return null;
}

export default async (req, res) => {
	const { text, targetLanguageName, _hp } = req.body || {};
	const ip = req.ip || 'unknown';

	// Honeypot: silently discard bot submissions
	if (_hp && String(_hp).trim().length > 0) {
		logger.warn(`translate: honeypot triggered ip=${ip}`);
		return res.json({ detectedLanguageName: '', detectedLanguageCode: '', translation: '' });
	}

	if (!text || typeof text !== 'string' || !text.trim()) {
		return res.status(422).json({ error: 'Text is required.' });
	}

	if (text.length > MAX_TEXT_LENGTH) {
		logger.warn(`translate: oversized input length=${text.length} ip=${ip}`);
		return res.status(422).json({ error: `Text must not exceed ${MAX_TEXT_LENGTH} characters.` });
	}

	if (!targetLanguageName || typeof targetLanguageName !== 'string') {
		return res.status(422).json({ error: 'Target language is required.' });
	}

	if (!process.env.INTEGRATED_AI_API_URL || !process.env.INTEGRATED_AI_API_KEY) {
		throw new Error('Integrated AI is not configured in the environment');
	}

	logger.info(`translate: target="${targetLanguageName}" textLen=${text.trim().length} ip=${ip}`);

	const userPrompt = `Translate the following source text into ${targetLanguageName}. The "translation" field in your JSON response MUST be entirely in ${targetLanguageName}.\n\nSource text:\n${text.trim()}`;

	const response = await fetch(`${process.env.INTEGRATED_AI_API_URL}/generate`, {
		method: 'POST',
		headers: {
			'Accept': 'text/event-stream',
			'Content-Type': 'application/json',
			'Authorization': `Bearer ${process.env.INTEGRATED_AI_API_KEY}`,
			...(process.env.PROXY_ENTRANCE_ID && { 'X-Proxy-Entrance-Id': process.env.PROXY_ENTRANCE_ID }),
		},
		body: JSON.stringify({
			website_id: process.env.WEBSITE_ID,
			history: [{ role: 'user', content: userPrompt }],
			system_prompt: SYSTEM_PROMPT,
			stream: false,
			environment: process.env.NODE_ENV === NodeEnv.Production ? 'prod' : 'dev',
		}),
		signal: AbortSignal.timeout(60000),
	});

	if (!response.ok) {
		const errorBody = await response.text().catch(() => '');
		logger.error(`translate: upstream failed ${response.status} ${response.statusText} ${errorBody}`);
		throw new Error(`AI proxy request failed: ${response.status} ${response.statusText} ${errorBody}`);
	}

	const raw = await collectContent(response);
	const parsed = parseResult(raw);

	if (!parsed || !parsed.translation) {
		res.json({
			detectedLanguageName: 'Unbekannt',
			detectedLanguageCode: '',
			translation: raw.trim(),
		});
		return;
	}

	logger.info(`translate: detected="${parsed.detectedLanguageCode}" → target="${targetLanguageName}" translationLen=${parsed.translation?.length}`);
	res.json({
		detectedLanguageName: parsed.detectedLanguageName || 'Unknown',
		detectedLanguageCode: parsed.detectedLanguageCode || '',
		translation: parsed.translation,
	});
};
