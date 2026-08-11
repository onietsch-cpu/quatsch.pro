import assert from 'node:assert/strict';
import test from 'node:test';
import { startServer } from '../src/main.js';

test('health endpoint reports liveness without exposing secrets', async (t) => {
	const server = startServer({ port: 0 });
	await new Promise((resolve) => server.once('listening', resolve));
	t.after(() => new Promise((resolve) => server.close(resolve)));
	const { port } = server.address();

	const response = await fetch(`http://127.0.0.1:${port}/healthz`);
	assert.equal(response.status, 200);
	assert.deepEqual(await response.json(), { status: 'ok', aiProviderConfigured: false });
	assert.ok(response.headers.get('x-request-id'));
});

test('AI endpoint fails cleanly when the provider is not configured', async (t) => {
	const previousKey = process.env.OPENAI_API_KEY;
	delete process.env.OPENAI_API_KEY;
	const server = startServer({ port: 0 });
	await new Promise((resolve) => server.once('listening', resolve));
	t.after(() => {
		if (previousKey !== undefined) process.env.OPENAI_API_KEY = previousKey;
		return new Promise((resolve) => server.close(resolve));
	});
	const { port } = server.address();

	const response = await fetch(`http://127.0.0.1:${port}/hcgi/api/translate`, {
		method: 'POST',
		headers: { 'content-type': 'application/json', 'x-requested-with': 'XMLHttpRequest' },
		body: JSON.stringify({ text: 'Hello', targetLanguageName: 'German' }),
	});
	assert.equal(response.status, 503);
	const payload = await response.json();
	assert.equal(payload.error, 'The service is temporarily unavailable.');
	assert.ok(payload.requestId);
});
