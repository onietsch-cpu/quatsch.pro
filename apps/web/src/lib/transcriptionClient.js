import apiServerClient from '@/lib/apiServerClient';

function blobToDataUrl(blob) {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(String(reader.result || ''));
		reader.onerror = () => reject(new Error('audio-read-failed'));
		reader.readAsDataURL(blob);
	});
}

export async function transcribeAudio({ audioBlob, sourceLanguageCode, signal }) {
	const audioDataUrl = await blobToDataUrl(audioBlob);
	const response = await apiServerClient.fetch('/transcribe', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'X-Requested-With': 'XMLHttpRequest',
		},
		body: JSON.stringify({
			audioDataUrl,
			sourceLanguageCode,
		}),
		signal,
	});

	if (!response.ok) {
		const err = new Error('transcription-failed');
		err.code = response.status === 422 ? 'no-speech' : 'api';
		err.status = response.status;
		throw err;
	}

	const payload = await response.json();
	return String(payload.text || '').trim();
}
