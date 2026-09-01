import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Check, ArrowRight, ArrowLeft, X, Repeat, ArrowRightLeft } from 'lucide-react';
import {
	LANGUAGES,
	DIALOG_LANGUAGES,
	QUICK_CODES,
	DIALOG_QUICK_CODES,
	getLanguageByCode,
} from '@/lib/languages';

function LanguagePicker({ selected, onSelect, languages, quickCodes }) {
	const [query, setQuery] = useState('');

	const quickLangs = useMemo(
		() => quickCodes.map(getLanguageByCode).filter(Boolean),
		[quickCodes],
	);

	const filtered = useMemo(() => {
		const q = query.trim().toLowerCase();
		if (!q) return languages;
		return languages.filter(
			(l) =>
				l.name.toLowerCase().includes(q) ||
				l.native.toLowerCase().includes(q) ||
				l.code.toLowerCase().includes(q),
		);
	}, [query, languages]);

	return (
		<>
			<div className="relative mt-6">
				<Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
				<input
					type="text"
					value={query}
					onChange={(e) => setQuery(e.target.value)}
					placeholder="Search language …"
					className="w-full rounded-2xl border border-slate-200 bg-white py-4 pl-12 pr-4 text-base text-slate-900 shadow-sm outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-200"
				/>
			</div>

			{!query && (
				<div className="mt-6">
					<p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
						Frequently used
					</p>
					<div className="flex flex-wrap gap-2">
						{quickLangs.map((l) => (
							<button
								key={l.code}
								onClick={() => onSelect(l.code)}
								className={`rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
									selected === l.code
										? 'border-teal-500 bg-teal-500 text-white'
										: 'border-slate-200 bg-white text-slate-700 hover:border-teal-300'
								}`}
							>
								{l.name}
							</button>
						))}
					</div>
				</div>
			)}

			<div className="mt-6 space-y-2">
				{filtered.length === 0 && (
					<p className="py-8 text-center text-sm text-slate-400">
						No language found.
					</p>
				)}
				{filtered.map((l) => {
					const active = selected === l.code;
					return (
						<button
							key={l.code}
							onClick={() => onSelect(l.code)}
							className={`flex w-full items-center justify-between rounded-2xl border px-5 py-4 text-left transition-colors ${
								active
									? 'border-teal-500 bg-teal-50'
									: 'border-slate-200 bg-white hover:border-slate-300'
							}`}
						>
							<span>
								<span className="block text-base font-semibold text-slate-900">
									{l.name}
								</span>
								{l.native !== l.name && (
									<span className="block text-sm text-slate-500">{l.native}</span>
								)}
							</span>
							{active && (
								<span className="flex h-7 w-7 items-center justify-center rounded-full bg-teal-500 text-white">
									<Check className="h-4 w-4" />
								</span>
							)}
						</button>
					);
				})}
			</div>
		</>
	);
}

export default function LanguageSelector({ onConfirm, onCancel, forceMode }) {
	// 'single' = translation into a fixed target language; 'dialog' = alternating translation in both directions.
	const [mode, setMode] = useState(forceMode || 'single');
	// Step in dialog mode: 1 = choose your own language, 2 = choose your conversation partner's language.
	const [step, setStep] = useState(1);
	const [ownCode, setOwnCode] = useState(null);
	const [partnerCode, setPartnerCode] = useState(null);
	const [singleCode, setSingleCode] = useState(null);

	const handleModeChange = (nextMode) => {
		setMode(nextMode);
		setStep(1);
	};

	const canGoNext = step === 1 ? Boolean(ownCode) : Boolean(partnerCode);

	const handlePrimaryAction = () => {
		if (mode === 'single') {
			if (singleCode) onConfirm({ mode: 'single', targetCode: singleCode });
			return;
		}
		if (step === 1) {
			if (ownCode) setStep(2);
			return;
		}
		if (partnerCode) {
			onConfirm({ mode: 'dialog', langACode: ownCode, langBCode: partnerCode });
		}
	};

	const title =
		mode === 'single'
			? 'Which language should we translate into?'
			: step === 1
			? 'Which language do you speak?'
			: 'Which language does your conversation partner speak?';

	return (
		<div className="min-h-[100dvh] bg-gradient-to-b from-[#EAF2FB] to-white px-5 pb-48 pt-8 md:pb-32">
			<div className="mx-auto w-full max-w-lg">
				<div className="flex items-center justify-between">
					<button
						onClick={() => {
							if (mode === 'dialog' && step === 2) {
								setStep(1);
							} else {
								onCancel();
							}
						}}
						className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700"
					>
						{mode === 'dialog' && step === 2 ? (
							<>
								<ArrowLeft className="h-4 w-4" /> Back
							</>
						) : (
							<>
								<X className="h-4 w-4" /> Cancel
							</>
						)}
					</button>
				</div>

				{/* Modusauswahl */}
				{!forceMode && (
					<div className="mt-4 grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1">
						<button
							onClick={() => handleModeChange('single')}
							className={`flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${
								mode === 'single'
									? 'bg-white text-slate-900 shadow-sm'
									: 'text-slate-500 hover:text-slate-700'
							}`}
						>
							<ArrowRight className="h-4 w-4" /> Single Direction
						</button>
						<button
							onClick={() => handleModeChange('dialog')}
							className={`flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${
								mode === 'dialog'
									? 'bg-white text-slate-900 shadow-sm'
									: 'text-slate-500 hover:text-slate-700'
							}`}
						>
							<ArrowRightLeft className="h-4 w-4" /> Dialog Mode
						</button>
					</div>
				)}

				{mode === 'dialog' && (
					<div className="mt-4 flex items-center gap-2">
						<span
							className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
								step === 1 ? 'bg-teal-500 text-white' : 'bg-teal-100 text-teal-600'
							}`}
						>
							1
						</span>
						<span className="h-px flex-1 bg-slate-200" />
						<span
							className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
								step === 2 ? 'bg-teal-500 text-white' : 'bg-slate-100 text-slate-400'
							}`}
						>
							2
						</span>
					</div>
				)}

				<h2 className="mt-4 text-2xl font-extrabold tracking-tight text-slate-900">{title}</h2>

				{mode === 'dialog' && (
					<p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500">
						<Repeat className="h-3.5 w-3.5" />
						In dialog mode, translation automatically alternates between both languages. A fixed
						selection of {DIALOG_LANGUAGES.length} languages is available.
					</p>
				)}

				<AnimatePresence mode="wait">
					{mode === 'single' && (
						<motion.div
							key="single"
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							transition={{ duration: 0.15 }}
						>
							<LanguagePicker
								selected={singleCode}
								onSelect={setSingleCode}
								languages={LANGUAGES}
								quickCodes={QUICK_CODES}
							/>
						</motion.div>
					)}
					{mode === 'dialog' && step === 1 && (
						<motion.div
							key="own"
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							transition={{ duration: 0.15 }}
						>
							<LanguagePicker
								selected={ownCode}
								onSelect={setOwnCode}
								languages={DIALOG_LANGUAGES}
								quickCodes={DIALOG_QUICK_CODES}
							/>
						</motion.div>
					)}
					{mode === 'dialog' && step === 2 && (
						<motion.div
							key="partner"
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							transition={{ duration: 0.15 }}
						>
							<LanguagePicker
								selected={partnerCode}
								onSelect={setPartnerCode}
								languages={DIALOG_LANGUAGES}
								quickCodes={DIALOG_QUICK_CODES}
							/>
						</motion.div>
					)}
				</AnimatePresence>
			</div>

			<div className="fixed inset-x-0 bottom-16 z-10 border-t border-slate-100 bg-white/95 px-5 py-4 backdrop-blur md:bottom-0">
				<div className="mx-auto w-full max-w-lg">
					<motion.button
						whileTap={{ scale: (mode === 'single' ? singleCode : canGoNext) ? 0.97 : 1 }}
						disabled={mode === 'single' ? !singleCode : !canGoNext}
						onClick={handlePrimaryAction}
						className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#1976D2] px-6 py-4 text-lg font-bold text-white shadow-lg shadow-[#1976D2]/20 transition-colors hover:bg-[#0B1F3A] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
					>
						{mode === 'single' || step === 2 ? 'Start Dialog' : 'Next'}
						<ArrowRight className="h-5 w-5" />
					</motion.button>
				</div>
			</div>
		</div>
	);
}
