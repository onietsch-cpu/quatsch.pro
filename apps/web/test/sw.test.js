import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const workerSource = await readFile(new URL('../public/sw.js', import.meta.url), 'utf8');

function createWorker({ cacheNames = [], fetchResponse } = {}) {
	const listeners = new Map();
	const deleted = [];
	const puts = [];
	let opened = 0;
	const response =
		fetchResponse ||
		new Response('asset', { status: 200, headers: { 'content-type': 'application/javascript' } });
	Object.defineProperty(response, 'type', { configurable: true, value: 'basic' });

	const context = {
		URL,
		Response,
		Set,
		fetch: async () => response,
		caches: {
			keys: async () => cacheNames,
			delete: async (key) => {
				deleted.push(key);
				return true;
			},
			open: async () => {
				opened += 1;
				return {
					put: async (request, value) => puts.push({ request, value }),
				};
			},
			match: async () => undefined,
		},
		self: {
			location: { origin: 'https://quatsch.pro' },
			clients: { claim: async () => undefined },
			skipWaiting: async () => undefined,
			addEventListener: (name, handler) => listeners.set(name, handler),
		},
	};

	vm.runInNewContext(workerSource, context);
	return { deleted, listeners, opened: () => opened, puts };
}

async function dispatchExtendable(handler, event = {}) {
	let pending;
	handler({ ...event, waitUntil: (promise) => (pending = promise) });
	await pending;
}

test('activate deletes every legacy shell cache and preserves unrelated caches', async () => {
	const worker = createWorker({
		cacheNames: [
			'ce-translator-shell-v1',
			'ce-translator-shell-stale',
			'ce-translator-static-v0',
			'ce-translator-static-v1',
			'unrelated-cache',
		],
	});

	await dispatchExtendable(worker.listeners.get('activate'));
	assert.deepEqual(worker.deleted.sort(), [
		'ce-translator-shell-stale',
		'ce-translator-shell-v1',
		'ce-translator-static-v0',
	]);
});

test('navigation requests bypass the service worker cache', () => {
	const worker = createWorker();
	let responsePromise;

	worker.listeners.get('fetch')({
		request: {
			headers: new Headers(),
			method: 'GET',
			mode: 'navigate',
			destination: 'document',
			url: 'https://quatsch.pro/conversation',
		},
		respondWith: (promise) => (responsePromise = promise),
	});

	assert.equal(responsePromise, undefined);
	assert.equal(worker.opened(), 0);
});

test('HTML responses are never written to the asset cache', async () => {
	const worker = createWorker({
		fetchResponse: new Response('<!doctype html>', {
			status: 200,
			headers: { 'content-type': 'text/html; charset=utf-8' },
		}),
	});
	let responsePromise;

	worker.listeners.get('fetch')({
		request: {
			headers: new Headers(),
			method: 'GET',
			mode: 'cors',
			destination: 'script',
			url: 'https://quatsch.pro/assets/missing.js',
		},
		respondWith: (promise) => (responsePromise = promise),
	});

	const response = await responsePromise;
	assert.equal(response.headers.get('content-type'), 'text/html; charset=utf-8');
	assert.equal(worker.opened(), 0);
	assert.equal(worker.puts.length, 0);
});

test('successful same-origin static assets are cached', async () => {
	const worker = createWorker();
	let responsePromise;
	const request = {
		headers: new Headers(),
		method: 'GET',
		mode: 'cors',
		destination: 'script',
		url: 'https://quatsch.pro/assets/app.js',
	};

	worker.listeners.get('fetch')({
		request,
		respondWith: (promise) => (responsePromise = promise),
	});

	await responsePromise;
	assert.equal(worker.opened(), 1);
	assert.equal(worker.puts.length, 1);
	assert.equal(worker.puts[0].request, request);
});
