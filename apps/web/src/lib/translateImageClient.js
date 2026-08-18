import { fetchWithRetry } from '@/lib/apiHealth';

const MAX_SIZE_BYTES = 8 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export function validateImageFile(file) {
	if (!ALLOWED_TYPES.includes(file.type)) {
		throw Object.assign(new Error('Only JPG, PNG, and WebP images are allowed.'), { code: 'invalid-type' });
	}
	if (file.size > MAX_SIZE_BYTES) {
		throw Object.assign(new Error('Image must be smaller than 8 MB.'), { code: 'too-large' });
	}
}

export function fileToBase64(file) {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => {
			// result is "data:image/...;base64,XXXX" — strip prefix
			const result = reader.result;
			const base64 = result.split(',')[1];
			resolve(base64);
		};
		reader.onerror = () => reject(new Error('Failed to read image file.'));
		reader.readAsDataURL(file);
	});
}

export async function translateImage({ file, targetLanguageName, honeypot = '' }) {
	validateImageFile(file);
	const base64 = await fileToBase64(file);

	const response = await fetchWithRetry('/translate-image', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'X-Requested-With': 'XMLHttpRequest',
		},
		body: JSON.stringify({
			image: base64,
			mimeType: file.type,
			targetLanguageName,
			_hp: honeypot,
		}),
	});

	if (!response.ok) {
		const err = await response.json().catch(() => ({}));
		const code = response.status >= 500 ? 'api' : response.status === 422 ? 'validation' : 'api';
		throw Object.assign(new Error(err.error || 'Image translation failed.'), { code });
	}

	return response.json();
}
