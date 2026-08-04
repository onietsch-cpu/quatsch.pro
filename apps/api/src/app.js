// apps/api/src/app.js
// Express app setup — exported without starting the server.
// Used by main.js (local dev) and api/index.js (Vercel serverless).

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

import routes from './routes/index.js';
import { errorMiddleware } from './middleware/error.js';
import { globalRateLimit } from './middleware/global-rate-limit.js';
import { BodyLimit } from './constants/common.js';

const app = express();

app.set('trust proxy', true);

app.use(helmet());
app.use(cors({
	origin: process.env.CORS_ORIGIN || false,
	methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'QUERY'],
	allowedHeaders: ['Authorization', 'Content-Type', 'X-Requested-With'],
}));
app.use(morgan('combined'));
app.use(globalRateLimit);
app.use(express.json({ limit: BodyLimit }));
app.use(express.urlencoded({ extended: true, limit: BodyLimit }));

// Mount at both root (Hostinger proxy strips /hcgi/api) and /hcgi/api
const appRoutes = routes();
app.use('/', appRoutes);
app.use('/hcgi/api', appRoutes);

app.use(errorMiddleware);

export default app;
