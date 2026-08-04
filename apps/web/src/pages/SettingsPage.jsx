import { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Trash2, ShieldCheck, Info } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import InstallButton from '@/components/InstallButton';
import { LANGUAGES } from '@/lib/languages';
import { DEFAULT_SETTINGS, clearHistory, getSettings, saveSettings } from '@/lib/storage';

const APP_VERSION = '1.0.0';

function applyTheme(theme) {
	const root = document.documentElement;
	const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
	const dark = theme === 'dark' || (theme === 'system' && prefersDark);
	root.classList.toggle('dark', dark);
}

export default function SettingsPage() {
	const [settings, setSettings] = useState(DEFAULT_SETTINGS);
	const [cleared, setCleared] = useState(false);

	useEffect(() => {
		const s = getSettings();
		setSettings(s);
		applyTheme(s.theme);
	}, []);

	const update = (patch) => {
		const next = { ...settings, ...patch };
		setSettings(next);
		saveSettings(next);
		if (patch.theme) applyTheme(patch.theme);
	};

	return (
		<div className="mx-auto w-full max-w-lg px-5 pb-16 pt-8">
			<Helmet>
				<title>CE Translator – Settings</title>
			</Helmet>

			<h1 className="text-2xl font-extrabold tracking-tight text-[#0B1F3A] dark:text-white">
				Settings
			</h1>

			<section className="mt-6 space-y-4 rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-[#0F2A4A]">
				<h2 className="text-sm font-bold uppercase tracking-wide text-slate-400">Read Aloud</h2>

				<div className="flex items-center justify-between gap-4">
					<label htmlFor="auto-read" className="text-base font-medium text-[#0B1F3A] dark:text-white">
						Auto Read Aloud
					</label>
					<Switch
						id="auto-read"
						checked={settings.autoRead}
						onCheckedChange={(v) => update({ autoRead: v })}
					/>
				</div>

				<div>
					<div className="flex items-center justify-between">
						<label htmlFor="rate" className="text-base font-medium text-[#0B1F3A] dark:text-white">
							Speech Rate
						</label>
						<span className="text-sm font-semibold text-[#1976D2]">{settings.rate.toFixed(2)}x</span>
					</div>
					<Slider
						id="rate"
						min={0.75}
						max={1.25}
						step={0.05}
						value={[settings.rate]}
						onValueChange={([v]) => update({ rate: v })}
						className="mt-3"
					/>
				</div>
			</section>

			<section className="mt-4 space-y-4 rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-[#0F2A4A]">
				<h2 className="text-sm font-bold uppercase tracking-wide text-slate-400">Language & Appearance</h2>

				<div>
					<label htmlFor="pref-lang" className="text-base font-medium text-[#0B1F3A] dark:text-white">
						Preferred Target Language
					</label>
					<select
						id="pref-lang"
						value={settings.preferredTargetCode}
						onChange={(e) => update({ preferredTargetCode: e.target.value })}
						className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base text-[#0B1F3A] outline-none focus:border-[#1976D2] focus:ring-2 focus:ring-[#1976D2]/30 dark:bg-[#0B1F3A] dark:text-white"
					>
						{LANGUAGES.map((l) => (
							<option key={l.code} value={l.code}>
								{l.name}
							</option>
						))}
					</select>
				</div>

				<div>
					<span className="text-base font-medium text-[#0B1F3A] dark:text-white">Appearance</span>
					<div className="mt-2 grid grid-cols-3 gap-2 rounded-2xl bg-slate-100 p-1 dark:bg-white/10">
						{[
							{ v: 'light', label: 'Light' },
							{ v: 'dark', label: 'Dark' },
							{ v: 'system', label: 'System' },
						].map((opt) => (
							<button
								key={opt.v}
								onClick={() => update({ theme: opt.v })}
								className={`rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${
									settings.theme === opt.v
										? 'bg-[#1976D2] text-white'
										: 'text-slate-500 dark:text-white/70'
								}`}
							>
								{opt.label}
							</button>
						))}
					</div>
				</div>
			</section>

			<section className="mt-4 space-y-4 rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-[#0F2A4A]">
				<h2 className="text-sm font-bold uppercase tracking-wide text-slate-400">History</h2>

				<div className="flex items-center justify-between gap-4">
					<label htmlFor="save-history" className="text-base font-medium text-[#0B1F3A] dark:text-white">
						Save conversation history locally
					</label>
					<Switch
						id="save-history"
						checked={settings.saveHistory}
						onCheckedChange={(v) => update({ saveHistory: v })}
					/>
				</div>

				<button
					onClick={() => {
						clearHistory();
						setCleared(true);
						setTimeout(() => setCleared(false), 1600);
					}}
					className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#C62828]/40 px-4 py-3 text-sm font-semibold text-[#C62828] transition-colors hover:bg-[#C62828]/5"
				>
					<Trash2 className="h-4 w-4" aria-hidden="true" />
					{cleared ? 'History cleared' : 'Clear history'}
				</button>
			</section>

			<section className="mt-4 space-y-3 rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-[#0F2A4A]">
				<h2 className="text-sm font-bold uppercase tracking-wide text-slate-400">Installation</h2>
				<InstallButton className="w-full" />
				<p className="flex items-start gap-2 text-xs leading-relaxed text-slate-500 dark:text-white/60">
					<Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
					Android: browser menu → “Install app” or “Add to Home screen”. Windows: install icon in
					the Chrome/Edge address bar. macOS: the browser's install feature, or “Add to Dock” in
					Safari.
				</p>
			</section>

			<section className="mt-4 space-y-2 rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-[#0F2A4A]">
				<h2 className="text-sm font-bold uppercase tracking-wide text-slate-400">Privacy</h2>
				<p className="flex items-start gap-2 text-xs leading-relaxed text-slate-500 dark:text-white/60">
					<ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
					For translations, the entered text or speech transcript is sent to the translation
					service used. Audio recordings are not permanently stored.
					Conversation history remains exclusively local on this device.
				</p>
				<p className="pt-2 text-xs text-slate-400">App version {APP_VERSION}</p>
			</section>
		</div>
	);
}
