import { fileURLToPath } from 'url';
import path from 'path';
import app from './app.js';
import logger from './utils/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

process.on('uncaughtException', (error) => {
	logger.error('Uncaught exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
	logger.error('Unhandled rejection at:', promise, 'reason:', reason);
});

process.on('SIGINT', async () => {
	logger.info('Interrupted');
	process.exit(0);
});

process.on('SIGTERM', async () => {
	logger.info('SIGTERM signal received');
	await new Promise(resolve => setTimeout(resolve, 3000));
	logger.info('Exiting');
	process.exit();
});

// In production (Heroku), serve the built React frontend
const distPath = path.join(__dirname, '../../../dist/apps/web');
if (process.env.NODE_ENV === 'production') {
	const { default: express } = await import('express');
	app.use(express.static(distPath));
	app.get('*', (req, res) => {
		res.sendFile(path.join(distPath, 'index.html'));
	});
} else {
	app.use((req, res) => {
		res.status(404).json({ error: 'Route not found' });
	});
}

const port = process.env.PORT || 3001;

app.listen(port, () => {
	logger.info(`🚀 API Server running on http://localhost:${port}`);
});

export default app;
