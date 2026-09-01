import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, ShieldCheck, ExternalLink } from 'lucide-react';
import InstallButton from '@/components/InstallButton';
import { ackPrivacy, hasAckedPrivacy } from '@/lib/storage';

const SPONSORS = [
	{
		name: 'Secure. Fast. Private. With NordVPN.',
		subtitle: 'Protect your connection, privacy and data online.',
		url: 'https://go.nordvpn.net/aff_c?offer_id=15&aff_id=152465',
	},
	{
		name: 'Safety Wing Travelinsurance',
		subtitle: 'Worldwide longtime protection for a good price',
		url: 'https://safetywing.com/nomad-insurance?referenceID=26564066&utm_source=26564066&utm_medium=Ambassador',
	},
	{
		name: 'nurx.com',
		subtitle: 'Get weight management treatment for as low as $0 with insurance',
		url: 'https://api.adindex.com/v1/redirect?advertiserId=11EE9038E2B36F6284AA14DDA9D518B0&adspaceId=11F1A2D383B6DABDBBD014DDA9D518B0',
	},
	{
		name: 'deutschland.money',
		subtitle: 'Dachportal für Immobilien, Finanzen und Firmengründung',
		url: 'https://deutschland.money',
	},
];

export default function StartScreen({ onStart }) {
	const [showPrivacy, setShowPrivacy] = useState(false);

	useEffect(() => {
		setShowPrivacy(!hasAckedPrivacy());
	}, []);

	return (
		<div className="flex min-h-[100dvh] flex-col items-center justify-start bg-gradient-to-b from-[#EAF2FB] via-white to-[#EAF2FB] px-6 pb-16 pt-10 sm:pt-12">
			<motion.div
				initial={{ opacity: 0, y: 24 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.6, ease: 'easeOut' }}
				className="w-full max-w-md text-center"
			>
				<div className="mx-auto mb-8">
					<img
						src="/ce-translator-logo-2026.png"
						alt="CE Translator Logo"
						width="202"
						height="168"
						className="mx-auto h-auto w-40 max-w-full"
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
