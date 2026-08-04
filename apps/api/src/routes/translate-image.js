import { NodeEnv } from '../constants/common.js';
import logger from '../utils/logger.js';
import pocketbaseClient from '../utils/pocketbaseClient.js';

const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const EXT_BY_TYPE = {
	'image/jpeg': 'jpg',
	'image/png': 'png',
	'image/webp': 'webp',
};

/**
 * Uploads a base64 image to PocketBase and returns a signed https URL the
 * AI gateway can fetch (the gateway rejects data: URLs — only http/https).
 */
async function uploadAndSign(buffer, mimeType) {
	const formData = new FormData();
	const blob = new Blob([buffer], { type: mimeType });
	formData.append('file', blob, `ocr.${EXT_BY_TYPE[mimeType] || 'png'}`);

	const record = await pocketbaseClient.collection('_integratedAiImages').create(formData);
	const rawUrl = pocketbaseClient.files.getURL(record, record.file);
	const publicUrl = rawUrl.replace(
		'http://localhost:8090',
		`https://${process.env.WEBSITE_DOMAIN}/hcgi/platform`,
	);

	const token = await pocketbaseClient.files.getToken();
	const signed = new URL(publicUrl);
	signed.searchParams.append('token', token);
	return signed.toString();
}

export default async (req, res) => {
	const { image, mimeType, targetLanguageName, _hp } = req.body || {};

	// Honeypot: real users never fill this hidden field
	if (_hp && String(_hp).trim().length > 0) {
		logger.warn('translate-image: honeypot triggered, dropping request silently');
		// Return a fake 200 so bots get no useful signal
		return res.json({ extractedText: '', translation: '', detectedLanguageName: '' });
	}

	if (!image || typeof image !== 'string') {
		return res.status(422).json({ error: 'image (base64) is required' });
	}
	if (!mimeType || !ALLOWED_TYPES.includes(mimeType)) {
		return res.status(422).json({ error: 'mimeType must be image/jpeg, image/png, or image/webp' });
	}
	if (!targetLanguageName || typeof targetLanguageName !== 'string') {
		return res.status(422).json({ error: 'targetLanguageName is required' });
	}

	const buffer = Buffer.from(image, 'base64');
	if (buffer.length > MAX_SIZE_BYTES) {
		return res.status(422).json({ error: 'Image exceeds 5 MB limit' });
	}

	if (!process.env.INTEGRATED_AI_API_URL || !process.env.INTEGRATED_AI_API_KEY) {
		throw new Error('Integrated AI is not configured in the environment');
	}

	let imageUrl;
	try {
		imageUrl = await uploadAndSign(buffer, mimeType);
	} catch (err) {
		logger.error('translate-image: failed to upload image to PocketBase', err);
		throw new Error(`Image upload failed: ${err.message}`);
	}

	const systemPrompt = `You are an OCR and translation engine.
Given an image:
1. Extract ALL text visible in the image exactly as written, preserving line breaks where sensible.
2. Translate the extracted text into the target language.
Respond ONLY with a compact JSON object in exactly this shape:
{"extractedText":"<all text found in the image>","translation":"<translated text in the target language>","detectedLanguageName":"<detected language of the text in English>"}
If no text is found, set extractedText to "" and translation to "".
Do not wrap in backticks or add any explanation.`;

	const userPrompt = `Target language: ${targetLanguageName}\n\nExtract and translate all text visible in the attached image.`;

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
			history: [
				{
					role: 'user',
					content: userPrompt,
					images: [imageUrl],
				},
			],
			system_prompt: systemPrompt,
			stream: false,
			environment: process.env.NODE_ENV === NodeEnv.Production ? 'prod' : 'dev',
		}),
		signal: AbortSignal.timeout(90000),
	});

	if (!response.ok) {
		const errorBody = await response.text().catch(() => '');
		logger.error(`translate-image: AI vision request failed ${response.status} ${response.statusText} ${errorBody}`);
		throw new Error(`AI vision request failed: ${response.status} ${response.statusText} ${errorBody}`);
	}

	// Collect SSE content
	let content = '';
	let buffer2 = '';
	const textStream = response.body.pipeThrough(new TextDecoderStream());
	for await (const chunk of textStream) {
		buffer2 += chunk;
		const lines = buffer2.split('\n');
		buffer2 = lines.pop() || '';
		for (const line of lines) {
			if (!line.startsWith('data: ')) continue;
			const jsonStr = line.slice(6).trim();
			if (!jsonStr || jsonStr === '[DONE]') continue;
			let event;
			try { event = JSON.parse(jsonStr); } catch { continue; }
			if (event.type === 'error') {
				logger.error('translate-image: AI vision stream error', event.data?.content);
				throw new Error(event.data?.content || 'AI vision error');
			}
			if (event.type === 'content' && event.data?.content) content += event.data.content;
		}
	}

	logger.info(`translate-image: raw AI content length=${content.length}`);

	// Parse result
	let text = content.trim();
	const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
	if (fenceMatch) text = fenceMatch[1].trim();
	const start = text.indexOf('{');
	const end = text.lastIndexOf('}');
	let parsed = null;
	if (start !== -1 && end !== -1 && end > start) {
		try { parsed = JSON.parse(text.slice(start, end + 1)); } catch { /* noop */ }
	}

	if (!parsed) {
		return res.json({ extractedText: text, translation: text, detectedLanguageName: 'Unknown' });
	}

	res.json({
		extractedText: parsed.extractedText || '',
		translation: parsed.translation || '',
		detectedLanguageName: parsed.detectedLanguageName || 'Unknown',
	});
};
