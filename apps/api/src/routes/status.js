import process from 'node:process';
import logger from '../utils/logger.js';

/**
 * Diagnostics endpoint: reports process uptime, memory, PocketBase reachability
 * and whether the Integrated AI credentials are configured.
 */
export default async (req, res) => {
	const started = Date.now();

	let pocketbase = 'unreachable';
	try {
		const pbRes = await fetch('http://localhost:8090/api/health', {
			method: 'GET',
			signal: AbortSignal.timeout(4000),
		});
		pocketbase = pbRes.ok ? 'ok' : `error:${pbRes.status}`;
	} catch (err) {
		pocketbase = `unreachable:${err.name}`;
	}

	const mem = process.memoryUsage();
	const payload = {
		status: 'ok',
		uptimeSeconds: Math.round(process.uptime()),
		memoryMB: {
			rss: Math.round(mem.rss / 1048576),
			heapUsed: Math.round(mem.heapUsed / 1048576),
			heapTotal: Math.round(mem.heapTotal / 1048576),
		},
		loadAverage: process.platform === 'linux' ? (await import('node:os')).loadavg().map(n => Number(n.toFixed(2))) : null,
		pocketbase,
		integratedAi: process.env.INTEGRATED_AI_API_URL && process.env.INTEGRATED_AI_API_KEY ? 'configured' : 'missing',
		checkedInMs: Date.now() - started,
		timestamp: new Date().toISOString(),
	};

	logger.info(`status: uptime=${payload.uptimeSeconds}s rss=${payload.memoryMB.rss}MB pb=${pocketbase} ai=${payload.integratedAi}`);

	res.json(payload);
};
