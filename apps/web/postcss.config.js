import path from 'node:path';
import { fileURLToPath } from 'node:url';

const directory = path.dirname(fileURLToPath(import.meta.url));

export default {
	plugins: {
		tailwindcss: {
			config: path.join(directory, 'tailwind.config.js'),
		},
		autoprefixer: {},
	},
};
