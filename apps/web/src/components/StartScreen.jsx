import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, ShieldCheck, ExternalLink } from 'lucide-react';
import InstallButton from '@/components/InstallButton';
import { ackPrivacy, hasAckedPrivacy } from '@/lib/storage';

const SPONSORS = [
	{ name: 'cashanlage.de', subtitle: 'Kapitalanlagen', url: 'https://cashanlage.de' },
	{ name: 'ihr-makler24.de', subtitle: 'Ihr Immobilienbüro', url: 'https://ihr-makler24.de' },
	{ name: 'finanzierungspilot.de', subtitle: 'Baufinanzierung', url: 'https://finanzierungspilot.de' },
	{ name: 'muh.bet', subtitle: 'Kostenloser Auswanderungsleitfaden', url: 'https://muh.bet' },
	{ name: 'vordiagnose.com', subtitle: 'Clinical pre-diagnosis, structured and safe', url: 'https://vordiagnose.com' },
];

export default function StartScreen({ onStart }) {
	const [showPrivacy, setShowPrivacy] = useState(false);

	useEffect(() => {
		setShowPrivacy(!hasAckedPrivacy());
	}, []);

	return (
		<div className="flex min-h-[100dvh] flex-col items-center justify-center bg-gradient-to-b from-[#EAF2FB] via-white to-[#EAF2FB] px-6 py-16">
			<motion.div
				initial={{ opacity: 0, y: 24 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.6, ease: 'easeOut' }}
				className="w-full max-w-md text-center"
			>
				<div className="mx-auto mb-8">
					<img
						src="https://horizons-cdn.hostinger.com/56d4caa5-10dd-4fb7-ac62-6701468e4bec/84e3be2d02d663c0cf98d622635c0599.png"
						alt="CE Translator Logo"
						className="mx-auto h-24 w-24"
					/>
				</div>

				<h1 className="text-3xl font-extrabold tracking-tight text-[#0B1F3A] sm:text-4xl">
					CE Translator
				</h1>
				<p className="mt-3 text-base text-slate-500">
					Which language should we translate into? Speak or type – we automatically detect the
					source language.
				</p>

				<motion.button
					whileTap={{ scale: 0.97 }}
					onClick={onStart}
					className="mt-10 inline-flex w-full items-center justify-center gap-3 rounded-2xl bg-[#1976D2] px-8 py-5 text-lg font-bold text-white shadow-lg shadow-[#1976D2]/20 transition-colors hover:bg-[#0B1F3A] active:bg-[#0B1F3A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0B1F3A]"
				>
					Start translation
					<ArrowRight className="h-6 w-6" aria-hidden="true" />
				</motion.button>

				<InstallButton className="mt-4 w-full" />

				<div className="mt-10 text-left">
					<div className="mb-3 flex items-center gap-2">
						<span className="rounded-full bg-[#FF7A00]/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-[#FF7A00]">
							Sponsored
						</span>
						<div className="h-px flex-1 bg-slate-200" />
					</div>
					<ul className="space-y-2">
						{SPONSORS.map((s) => (
							<li key={s.url}>
								<a
									href={s.url}
									target="_blank"
									rel="noopener noreferrer sponsored"
									className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 transition-colors hover:border-[#FF7A00]/40 hover:bg-[#FF7A00]/5"
								>
									<span>
										<span className="block text-sm font-bold text-[#0B1F3A]">{s.name}</span>
										<span className="block text-xs text-slate-500">{s.subtitle}</span>
									</span>
									<ExternalLink className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
								</a>
							</li>
						))}
					</ul>
				</div>

				{showPrivacy && (
					<div className="mt-6 flex items-start gap-2 rounded-2xl border border-[#1976D2]/20 bg-[#EAF2FB] px-4 py-3 text-left text-xs leading-relaxed text-[#0B1F3A]">
						<ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
						<div className="flex-1">
							For translations, the entered text or speech transcript is sent to the translation
							service used. Audio recordings are not permanently stored.
							<button
								onClick={() => {
									ackPrivacy();
									setShowPrivacy(false);
								}}
								className="mt-2 block font-semibold text-[#1976D2] underline underline-offset-2"
							>
								Got it
							</button>
						</div>
					</div>
				)}
			</motion.div>
		</div>
	);
}
