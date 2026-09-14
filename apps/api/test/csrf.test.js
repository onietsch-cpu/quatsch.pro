import test from 'node:test';
import assert from 'node:assert/strict';
import { csrfCheck } from '../src/middleware/csrf-check.js';
function check(headers) {
	let status = 200;
	csrfCheck({ method: 'POST', headers: { host: 'quatsch.pro', ...headers } }, { status(code) { status = code; return this; }, json() {} }, () => {});
	return status;
}
test('foreign and localhost-lookalike origins cannot bypass verification', () => {
	for (const origin of ['https://evil.example', 'https://localhost.evil.example', 'null']) {
		assert.equal(check({ origin, 'x-requested-with': 'XMLHttpRequest' }), 403);
	}
});
test('same origin and header-verified non-browser clients remain supported', () => {
	assert.equal(check({ origin: 'https://quatsch.pro' }), 200);
	assert.equal(check({ 'x-requested-with': 'XMLHttpRequest' }), 200);
	assert.equal(check({}), 403);
});
