function write(level, message, context) {
	const payload = {
		timestamp: new Date().toISOString(),
		level,
		message: message instanceof Error ? message.message : String(message),
		...(context && typeof context === 'object' ? context : {}),
	};
	const line = JSON.stringify(payload);
	if (level === 'error' || level === 'fatal') console.error(line);
	else console.log(line);
}

const logger = {
	error: (message, context) => write('error', message, context),
	fatal: (message, context) => write('fatal', message, context),
	info: (message, context) => write('info', message, context),
	debug: (message, context) => write('debug', message, context),
	warn: (message, context) => write('warn', message, context),
};

export default logger;
export { logger };
