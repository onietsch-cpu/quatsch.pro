// Vercel Serverless Function entry point.
// Wraps the Express app — Vercel's @vercel/node runtime calls this as a handler.
import app from '../apps/api/src/app.js';

export default app;
