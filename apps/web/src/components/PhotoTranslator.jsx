import { useCallback, useRef, useState } from 'react';
import { Camera, Upload, Loader2, X, Copy, Share2, Volume2, AlertTriangle, ImageIcon } from 'lucide-react';
import { translateImage } from '@/lib/translateImageClient';
import { speak, stopSpeaking } from '@/lib/speech';

export default function PhotoTranslator({ targetCode, targetName, settings }) {
	const [preview, setPreview] = useState(null); // object URL
	const [result, setResult] = useState(null);   // { extractedText, translation, detectedLanguageName }
	const [isTranslating, setIsTranslating] = useState(false);
	const [error, setError] = useState(null);
	const [copied, setCopied] = useState(false);

	const fileRef = useRef(null);
	const cameraRef = useRef(null);
	const currentFileRef = useRef(null);
	const honeypotRef = useRef(null);

	const handleFile = useCallback(
		async (file) => {
			if (!file) return;
			setError(null);
			setResult(null);
			setCopied(false);

			// Revoke old preview
			if (preview) URL.revokeObjectURL(preview);
			const url = URL.createObjectURL(file);
			setPreview(url);
			currentFileRef.current = file;

			setIsTranslating(true);
			try {
				const data = await translateImage({ file, targetLanguageName: targetName, honeypot: honeypotRef.current?.value ?? '' });
				setResult(data);
				if (settings?.autoRead && data.translation) {
					stopSpeaking();
					speak(data.translation, targetCode, { rateMultiplier: settings.rate ?? 1 });
				}
			} catch (err) {
				if (err.code === 'invalid-type') {
					setError('Only JPG, PNG, and WebP images are allowed.');
				} else if (err.code === 'too-large') {
					setError('The image is too large. Please use an image smaller than 5 MB.');
				} else if (err.code === 'validation') {
					setError(err.message || 'Invalid image.');
				} else {
					setError('The image could not be translated. Please try again.');
				}
			} finally {
				setIsTranslating(false);
			}
		},
		[preview, targetName, targetCode, settings],
	);

	const onFileChange = (e) => {
		const file = e.target.files?.[0];
		e.target.value = '';
		if (file) handleFile(file);
	};

	const handleClear = () => {
		if (preview) URL.revokeObjectURL(preview);
		setPreview(null);
		setResult(null);
		setError(null);
		currentFileRef.current = null;
	};

	const handleCopy = () => {
		if (!result?.translation) return;
		navigator.clipboard.writeText(result.translation).then(() => {
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		});
	};

	const handleShare = () => {
		if (!result?.translation) return;
		if (navigator.share) {
			navigator.share({ text: result.translation }).catch(() => {});
		} else {
			handleCopy();
		}
	};

	const handleSpeak = () => {
		if (!result?.translation) return;
		stopSpeaking();
		speak(result.translation, targetCode, { rateMultiplier: settings?.rate ?? 1 });
	};

	return (
		<div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
			<div className="flex items-center gap-2">
				<ImageIcon className="h-5 w-5 text-[#1976D2]" />
				<h3 className="text-base font-bold text-slate-900">Photo Translator</h3>
			</div>

			{/* Upload buttons */}
			{!preview && (
				<div className="grid grid-cols-2 gap-3">
					<button
						onClick={() => fileRef.current?.click()}
						className="flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm font-semibold text-slate-600 transition-colors hover:border-[#1976D2] hover:bg-blue-50 hover:text-[#1976D2]"
					>
						<Upload className="h-6 w-6" />
						Upload Photo
					</button>
					<button
						onClick={() => cameraRef.current?.click()}
						className="flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm font-semibold text-slate-600 transition-colors hover:border-teal-500 hover:bg-teal-50 hover:text-teal-600"
					>
						<Camera className="h-6 w-6" />
						Take Photo
					</button>
				</div>
			)}

			{/* Honeypot — hidden from users, filled only by bots */}
		<input
			ref={honeypotRef}
			type="text"
			name="_hp"
			autoComplete="off"
			tabIndex={-1}
			style={{ display: 'none' }}
			aria-hidden="true"
		/>
		{/* Hidden inputs */}
			<input
				ref={fileRef}
				type="file"
				accept="image/jpeg,image/png,image/webp"
				className="hidden"
				onChange={onFileChange}
			/>
			<input
				ref={cameraRef}
				type="file"
				accept="image/jpeg,image/png,image/webp"
				capture="environment"
				className="hidden"
				onChange={onFileChange}
			/>

			{/* Preview */}
			{preview && (
				<div className="relative">
					<img
						src={preview}
						alt="Preview"
						className="w-full rounded-xl object-contain max-h-56 bg-slate-100"
					/>
					{!isTranslating && (
						<button
							onClick={handleClear}
							className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-slate-600 shadow-sm hover:bg-white hover:text-slate-900"
							aria-label="Remove image"
						>
							<X className="h-4 w-4" />
						</button>
					)}
				</div>
			)}

			{/* Translating */}
			{isTranslating && (
				<div className="flex items-center gap-2 rounded-xl bg-blue-50 px-4 py-3 text-sm font-medium text-[#1976D2]">
					<Loader2 className="h-4 w-4 animate-spin" />
					Recognizing text and translating …
				</div>
			)}

			{/* Error */}
			{error && (
				<div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
					<AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
					<span className="flex-1">{error}</span>
					<button onClick={() => setError(null)} className="text-amber-500 hover:text-amber-700">
						<X className="h-4 w-4" />
					</button>
				</div>
			)}

			{/* Result */}
			{result && !isTranslating && (
				<div className="space-y-3">
					{result.extractedText && (
						<div className="rounded-xl bg-slate-50 px-4 py-3">
							<p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
								Recognized text · {result.detectedLanguageName}
							</p>
							<p className="text-sm text-slate-700 leading-relaxed">{result.extractedText}</p>
						</div>
					)}
					{result.translation ? (
						<div className="rounded-xl bg-teal-50 px-4 py-3">
							<p className="mb-1 text-xs font-semibold uppercase tracking-wide text-teal-500">
								Translation · {targetName}
							</p>
							<p className="text-base font-semibold text-slate-900 leading-relaxed">{result.translation}</p>
						</div>
					) : (
						<p className="text-sm text-slate-400 text-center py-2">No text found in the image.</p>
					)}

					{result.translation && (
						<div className="flex gap-2">
							<button
								onClick={handleSpeak}
								className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
							>
								<Volume2 className="h-4 w-4 text-[#1976D2]" />
								Read aloud
							</button>
							<button
								onClick={handleCopy}
								className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
							>
								<Copy className="h-4 w-4 text-slate-500" />
								{copied ? 'Copied!' : 'Copy'}
							</button>
							<button
								onClick={handleShare}
								className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
							>
								<Share2 className="h-4 w-4 text-slate-500" />
								Share
							</button>
						</div>
					)}

					{/* Try another */}
					<button
						onClick={handleClear}
						className="w-full rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-500 transition-colors hover:bg-slate-50"
					>
						Translate another photo
					</button>
				</div>
			)}
		</div>
	);
}
