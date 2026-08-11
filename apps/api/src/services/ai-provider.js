const DEFAULT_API_BASE_URL = 'https://api.openai.com/v1';
const DEFAULT_MODEL = 'gpt-4.1-mini';
const DEFAULT_TIMEOUT_MS = 45_000;
const MAX_RETRIES = 2;

export class UpstreamError extends Error {
	constructor(message, { status = 502, retryable = false } = {}) {
		super(message);
		this.name = 'UpstreamError';
		this.status = status;
		this.retryable = retryable;
	}
}

function trimTrailingSlashes(value) {
	return value.replace(/\/+$/, '');
}

export function getProviderConfig() {
	const apiKey = process.env.OPENAI_API_KEY || process.env.INTEGRATED_AI_API_KEY || '';
	const configuredBase = process.env.OPENAI_API_BASE_URL || process.env.INTEGRATED_AI_API_URL || DEFAULT_API_BASE_URL;
	const apiBaseUrl = trimTrailingSlashes(configuredBase)
		.replace(/\/chat\/completions$/i, '')
		.replace(/\/responses$/i, '')
		.replace(/\/audio\/speech$/i, '');

	return {
		apiKey,
		apiBaseUrl,
		model: process.env.OPENAI_TRANSLATION_MODEL || DEFAULT_MODEL,
		ttsModel: process.env.OPENAI_TTS_MODEL || 'tts-1',
	};
}

export function isProviderConfigured() {
	return Boolean(getProviderConfig().apiKey);
}

function retryDelay(attempt, retryAfter) {
	const parsed = Number.parseFloat(retryAfter || '');
	if (Number.isFinite(parsed) && parsed >= 0) {
		return Math.min(parsed * 1000, 5_000);
	}
	return Math.min(400 * (2 ** attempt) + Math.floor(Math.random() * 150), 3_000);
}

async function request(url, options, attempt = 0) {
	let response;
	try {
		response = await fetch(url, {
			...options,
			signal: AbortSignal.timeout(Number(process.env.AI_REQUEST_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS),
		});
	} catch (error) {
		if (attempt < MAX_RETRIES && (error.name === 'TimeoutError' || error.name === 'TypeError')) {
			await new Promise((resolve) => setTimeout(resolve, retryDelay(attempt)));
			return request(url, options, attempt + 1);
		}
		throw new UpstreamError('The AI provider could not be reached.', { status: 503, retryable: true });
	}

	if (response.ok) {
		return response;
	}

	const retryable = response.status === 429 || response.status >= 500;
	if (retryable && attempt < MAX_RETRIES) {
		await new Promise((resolve) => setTimeout(resolve, retryDelay(attempt, response.headers.get('retry-after'))));
		return request(url, options, attempt + 1);
	}

	const body = await response.text().catch(() => '');
	const detail = body.slice(0, 500).replace(/\s+/g, ' ');
	throw new UpstreamError(`AI provider request failed (${response.status})${detail ? `: ${detail}` : ''}`, {
		status: retryable ? 503 : 502,
		retryable,
	});
}

function authHeaders(apiKey) {
	return {
		Authorization: `Bearer ${apiKey}`,
		'Content-Type': 'application/json',
	};
}

function requireApiKey(config) {
	if (!config.apiKey) {
		throw new UpstreamError('The AI provider is not configured.', { status: 503 });
	}
}

export function parseJsonContent(raw) {
	let content = String(raw || '').trim();
	const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i);
	if (fenced) content = fenced[1].trim();
	const start = content.indexOf('{');
	const end = content.lastIndexOf('}');
	if (start < 0 || end <= start) {
		throw new UpstreamError('The AI provider returned an invalid response.', { status: 502 });
	}
	try {
		return JSON.parse(content.slice(start, end + 1));
	} catch {
		throw new UpstreamError('The AI provider returned invalid JSON.', { status: 502 });
	}
}

export async function generateJson({ systemPrompt, userPrompt, imageDataUrl }) {
	const config = getProviderConfig();
	requireApiKey(config);

	const userContent = imageDataUrl
		? [
			{ type: 'text', text: userPrompt },
			{ type: 'image_url', image_url: { url: imageDataUrl, detail: 'high' } },
		]
		: userPrompt;

	const response = await request(`${config.apiBaseUrl}/chat/completions`, {
		method: 'POST',
		headers: authHeaders(config.apiKey),
		body: JSON.stringify({
			model: config.model,
			messages: [
				{ role: 'system', content: systemPrompt },
				{ role: 'user', content: userContent },
			],
			response_format: { type: 'json_object' },
			temperature: 0,
		}),
	});

	const payload = await response.json();
	return parseJsonContent(payload.choices?.[0]?.message?.content);
}

export async function generateSpeech({ text, voice }) {
	const config = getProviderConfig();
	requireApiKey(config);

	return request(`${config.apiBaseUrl}/audio/speech`, {
		method: 'POST',
		headers: authHeaders(config.apiKey),
		body: JSON.stringify({
			model: config.ttsModel,
			input: text,
			voice,
			response_format: 'mp3',
		}),
	});
}
