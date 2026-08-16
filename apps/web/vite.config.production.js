import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const directory = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
	root: directory,
	plugins: [react()],
	resolve: {
		alias: { '@': path.join(directory, 'src') },
	},
	build: {
		outDir: path.resolve(directory, '../../dist/apps/web'),
		emptyOutDir: true,
		sourcemap: false,
	},
});
