import logger from '../utils/logger.js';
import { NodeEnv } from '../constants/common.js';

const errorMiddleware = (err, req, res, next) => {
	logger.error(err, {
		requestId: req.requestId,
		method: req.method,
		path: req.originalUrl,
		stack: process.env.NODE_ENV !== NodeEnv.Production ? err.stack : undefined,
	});
	if (res.headersSent) return next(err);

	const status = Number.isInteger(err.status) && err.status >= 400 && err.status <= 599 ? err.status : 500;
	res.status(status).json({
		error: status >= 500 ? 'The service is temporarily unavailable.' : err.message,
		requestId: req.requestId,
		...(process.env.NODE_ENV !== NodeEnv.Production && { detail: err.message }),
	});
};

export default errorMiddleware;
export { errorMiddleware };
