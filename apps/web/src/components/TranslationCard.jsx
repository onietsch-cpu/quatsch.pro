import { useState } from 'react';
import { motion } from 'framer-motion';
import { Volume2, Copy, RotateCcw, Check, Share2 } from 'lucide-react';
import { copyTextToClipboard } from '@/lib/clipboard';

export default function TranslationCard({ entry, targetName, onSpeak }) {
	const [copied, setCopied] = useState(false);

	const handleCopy = async () => {
		const ok = await copyTextToClipboard(entry.translation);
		if (ok) {
			setCopied(true);
			setTimeout(() => setCopied(false), 1600);
		} else {
			setCopied(false);
		}
	};

	return (
		<motion.div
			initial={{ opacity: 0, y: 16 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.35, ease: 'easeOut' }}
			className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
		>
			<div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
				<p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
					Detected: {entry.detectedLanguageName || 'Unknown'}
				</p>
				<p className="mt-1 text-base text-slate-700">{entry.original}</p>
			</div>

			<div className="px-4 py-4">
				<p className="text-[11px] font-semibold uppercase tracking-wide text-teal-500">
					{targetName}
				</p>
				<p className="mt-1 text-lg font-semibold leading-snug text-slate-900">
					{entry.translation}
				</p>

				<div className="mt-4 flex flex-wrap gap-2">
					<button
						onClick={() => onSpeak(entry)}
						className="inline-flex items-center gap-1.5 rounded-full bg-[#1976D2] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#0B1F3A] active:scale-[0.98]"
					>
						<Volume2 className="h-4 w-4" /> Read aloud
					</button>
					<button
						onClick={() => onSpeak(entry)}
						className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 active:scale-[0.98]"
					>
						<RotateCcw className="h-4 w-4" /> Repeat
					</button>
					<button
						onClick={handleCopy}
						className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 active:scale-[0.98]"
					>
						{copied ? <Check className="h-4 w-4 text-teal-500" /> : <Copy className="h-4 w-4" />}
						{copied ? 'Copied' : 'Copy'}
					</button>
					<button
						onClick={() => {
							if (navigator.share) {
								navigator.share({ text: entry.translation }).catch(() => {});
							} else {
								handleCopy();
							}
						}}
						className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 active:scale-[0.98]"
					>
						<Share2 className="h-4 w-4" /> Share
					</button>
				</div>
			</div>
		</motion.div>
	);
}
