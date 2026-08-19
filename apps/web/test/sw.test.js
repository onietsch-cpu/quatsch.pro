import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const workerSource = await readFile(new URL('../public/sw.js', import.meta.url), 'utf8');

function createWorker({ cacheNames = [] } = {}) {
	const listeners = new Map();
	const deleted = [];
	let claimed = 0;
	let matchedClients = 0;
	let skipped = 0;
	let unregistered = 0;

	const context = {
		caches: {
			keys: async () => cacheNames,
			delete: async (key) => {
				deleted.push(key);
				return true;
			},
		},
		self: {
			clients: {
				claim: async () => {
					claimed += 1;
				},
				matchAll: async () => {
					matchedClients += 1;
					return [];
				},
			},
			registration: {
				unregister: async () => {
					unregistered += 1;
					return true;
				},
			},
			skipWaiting: async () => {
				skipped += 1;
			},
			addEventListener: (name, handler) => listeners.set(name, handler),
		},
	};

	vm.runInNewContext(workerSource, context);
	return {
		claimed: () => claimed,
		deleted,
		listeners,
		matchedClients: () => matchedClients,
		skipped: () => skipped,
		unregistered: () => unregistered,
	};
}

async function dispatchExtendable(handler) {
	let pending;
	handler({ waitUntil: (promise) => (pending = promise) });
	await pending;
}

test('install activates the recovery worker immediately', async () => {
	const worker = createWorker();
	await dispatchExtendable(worker.listeners.get('install'));
	assert.equal(worker.skipped(), 1);
});

test('activate removes translator caches and unregisters without touching clients', async () => {
	const worker = createWorker({
		cacheNames: [
			'ce-translator-shell-v1',
			'ce-translator-static-v1',
			'unrelated-cache',
		],
	});

	await dispatchExtendable(worker.listeners.get('activate'));
	assert.deepEqual(worker.deleted.sort(), [
		'ce-translator-shell-v1',
		'ce-translator-static-v1',
	]);
	assert.equal(worker.claimed(), 0);
	assert.equal(worker.matchedClients(), 0);
	assert.equal(worker.unregistered(), 1);
});

test('recovery worker does not intercept requests', () => {
	const worker = createWorker();
	assert.equal(worker.listeners.has('fetch'), false);
});
