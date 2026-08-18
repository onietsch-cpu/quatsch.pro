const NodeEnv = {
	Development: 'development',
	Production: 'production',
};

// An 8 MiB image expands by roughly one third when sent as base64 JSON.
const BodyLimit = 1024 * 1024 * 12;

export { NodeEnv, BodyLimit };
