import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

import routes from './routes/index.js';
import { errorMiddleware } from './middleware/error.js';
import { globalRateLimit } from './middleware/global-rate-limit.js';
import logger from './utils/logger.js';
import { BodyLimit } from './constants/common.js';
import { isProviderConfigured } from './services/ai-provider.js';

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(currentDirectory, '../../..');
const webDist = path.join(repositoryRoot, 'dist/apps/web');
const SPA_ROUTES = new Set(['/', '/conversation', '/history', '/settings']);

export function isSpaRoute(requestPath) {
	const normalized = requestPath.length > 1 ? requestPath.replace(/\/+$/, '') : requestPath;
	return SPA_ROUTES.has(normalized);
}

export function createApp() {
	const app = express();
	app.disable('x-powered-by');
	app.set('trust proxy', 1);

	app.use((req, res, next) => {
		req.requestId = req.headers['x-request-id'] || crypto.randomUUID();
		res.setHeader('X-Request-Id', req.requestId);
		next();
	});
	app.use(helmet({
		contentSecurityPolicy: false,
		crossOriginEmbedderPolicy: false,
	}));
	app.use(morgan('combined'));

	app.get('/healthz', (req, res) => {
		res.setHeader('Cache-Control', 'no-store');
		res.json({ status: 'ok', aiProviderConfigured: isProviderConfigured() });
	});

	const corsOrigins = (process.env.CORS_ORIGIN || '')
		.split(',')
		.map((origin) => origin.trim())
		.filter(Boolean);
	const api = express.Router();
	api.use(cors({
		origin: corsOrigins.length ? corsOrigins : false,
		methods: ['GET', 'POST', 'OPTIONS'],
		allowedHeaders: ['Authorization', 'Content-Type', 'X-Requested-With', 'X-Request-Id'],
	}));
	api.use(globalRateLimit);
	api.use(express.json({ limit: BodyLimit }));
	api.use(express.urlencoded({ extended: true, limit: BodyLimit }));
	api.use(routes());
	api.use((req, res) => res.status(404).json({ error: 'Route not found' }));
	api.use(errorMiddleware);

	app.use('/hcgi/api', api);
	app.use('/api', api);
	app.use(express.static(webDist, {
		index: false,
		maxAge: process.env.NODE_ENV === 'production' ? '1h' : 0,
		setHeaders(res, filePath) {
			if (filePath.endsWith('.html') || filePath.endsWith('sw.js')) {
				res.setHeader('Cache-Control', 'no-cache');
			}
		},
	}));
	app.use((req, res, next) => {
		if (req.method !== 'GET' || !req.accepts('html') || !isSpaRoute(req.path)) return next();
		res.setHeader('Cache-Control', 'no-cache');
		return res.sendFile(path.join(webDist, 'index.html'));
	});
	app.use((req, res) => res.status(404).json({ error: 'Not found' }));
	app.use(errorMiddleware);

	return app;
}

export function startServer({ port = Number(process.env.PORT) || 3000 } = {}) {
	const app = createApp();
	const server = app.listen(port, '0.0.0.0', () => {
		logger.info('server_started', { port, aiProviderConfigured: isProviderConfigured() });
		if (!isProviderConfigured()) logger.warn('OPENAI_API_KEY is not configured; AI endpoints will return 503');
	});
	server.requestTimeout = 60_000;
	server.headersTimeout = 65_000;

	const shutdown = (signal) => {
		logger.info('server_shutdown', { signal });
		server.close((error) => process.exit(error ? 1 : 0));
		setTimeout(() => process.exit(1), 10_000).unref();
	};
	process.once('SIGINT', shutdown);
	process.once('SIGTERM', shutdown);
	return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	startServer();
}
