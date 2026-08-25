import { chromium } from 'playwright';

const browserUserAgent =
	'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36';

function assert(condition, message) {
	if (!condition) throw new Error(message);
}

function baseLanguage(code) {
	return String(code || '').toLowerCase().split(/[-_]/)[0];
}

async function waitForApplication(page, url) {
	const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45_000 });
	assert(response && response.status() >= 200 && response.status() < 400, `${url} returned HTTP ${response?.status()}`);
	await page.waitForFunction(() => !/checking your browser/i.test(document.title), null, { timeout: 45_000 });
	await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
	const documentState = await page.evaluate(() => ({
		contentType: document.contentType,
		htmlBytes: new TextEncoder().encode(document.documentElement.outerHTML).length,
		title: document.title,
	}));
	assert(documentState.contentType === 'text/html', `${url} returned ${documentState.contentType}`);
	assert(documentState.htmlBytes > 500, `${url} returned only ${documentState.htmlBytes} HTML bytes`);
	console.log(`PASS ${url}: HTTP ${response.status()}, ${documentState.htmlBytes} HTML bytes, title "${documentState.title}"`);
}

async function request(page, path, init = {}, binary = false) {
	return page.evaluate(
		async ({ path, init, binary }) => {
			const response = await fetch(path, init);
			const headers = Object.fromEntries(response.headers.entries());
			if (binary) {
				const body = await response.arrayBuffer();
				return { status: response.status, headers, bytes: body.byteLength };
			}
			return { status: response.status, headers, text: await response.text() };
		},
		{ path, init, binary },
	);
}

function parseJson(result, label) {
	try {
		return JSON.parse(result.text);
	} catch {
		throw new Error(`${label} returned non-JSON content (${result.headers['content-type'] || 'unknown type'})`);
	}
}

const browser = await chromium.launch({ headless: true });
try {
	const context = await browser.newContext({ userAgent: browserUserAgent });
	const page = await context.newPage();

	await waitForApplication(page, 'https://quatsch.pro/');
	await waitForApplication(page, 'https://www.quatsch.pro/');

	const healthz = await request(page, '/healthz');
	assert(healthz.status === 200, `/healthz returned HTTP ${healthz.status}`);
	console.log(`PASS /healthz: HTTP ${healthz.status}`);

	const apiHealth = await request(page, '/hcgi/api/health');
	assert(apiHealth.status === 200, `/hcgi/api/health returned HTTP ${apiHealth.status}`);
	const healthPayload = parseJson(apiHealth, '/hcgi/api/health');
	assert(healthPayload.status === 'ok', '/hcgi/api/health did not report status ok');
	assert(healthPayload.aiProviderConfigured === true, '/hcgi/api/health reported an unconfigured AI provider');
	console.log(`PASS /hcgi/api/health: HTTP ${apiHealth.status}`);

	for (const path of ['/.env', '/.git/config', '/wp-admin/install.php']) {
		const result = await request(page, path, { headers: { Accept: 'text/html' } });
		assert(result.status === 404, `${path} returned HTTP ${result.status}`);
		const payload = parseJson(result, path);
		assert(payload.error === 'Not found' && Object.keys(payload).length === 1, `${path} returned an unexpected body`);
		console.log(`PASS ${path}: HTTP ${result.status}`);
	}

	const translation = await request(page, '/hcgi/api/translate', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
		body: JSON.stringify({
			text: 'Abschliessender Produktions-Funktionstest.',
			targetLanguageName: 'English',
			targetLanguageCode: 'en-US',
		}),
	});
	assert(translation.status === 200, `/hcgi/api/translate returned HTTP ${translation.status}`);
	const translationPayload = parseJson(translation, '/hcgi/api/translate');
	assert(typeof translationPayload.translation === 'string' && translationPayload.translation.length > 0, 'Translation is empty');
	assert(baseLanguage(translationPayload.detectedLanguageCode) === 'de', 'Detected language is not German');
	assert(baseLanguage(translationPayload.translatedLanguageCode) === 'en', 'Translated language is not English');
	console.log(`PASS /hcgi/api/translate: HTTP ${translation.status}, request ${translation.headers['x-request-id'] || 'unknown'}`);

	const speech = await request(
		page,
		'/hcgi/api/tts',
		{
			method: 'POST',
			headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
			body: JSON.stringify({ text: 'Final production test successful.', langCode: 'en-US' }),
		},
		true,
	);
	assert(speech.status === 200, `/hcgi/api/tts returned HTTP ${speech.status}`);
	assert(String(speech.headers['content-type'] || '').startsWith('audio/mpeg'), 'TTS did not return audio/mpeg');
	const cacheControl = String(speech.headers['cache-control'] || '');
	assert(cacheControl.includes('private') && cacheControl.includes('no-store'), 'TTS cache policy is not private, no-store');
	assert(speech.bytes > 100, `TTS returned only ${speech.bytes} bytes`);
	console.log(`PASS /hcgi/api/tts: HTTP ${speech.status}, ${speech.bytes} bytes, request ${speech.headers['x-request-id'] || 'unknown'}`);

	console.log('PASS all production smoke checks');
} finally {
	await browser.close();
}
