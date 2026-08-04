import { useState } from 'react';
import { Download, Info, CheckCircle2 } from 'lucide-react';
import { useInstallPrompt } from '@/hooks/useInstallPrompt';

export default function InstallButton({ className = '' }) {
	const { canPrompt, isInstalled, promptInstall, instructions, supportsAutoPrompt } = useInstallPrompt();
	const [showHint, setShowHint] = useState(false);
	const [installing, setInstalling] = useState(false);

	if (isInstalled) {
		return (
			<div
				className={`inline-flex items-center justify-center gap-2 rounded-2xl border border-[#2E7D32]/30 bg-[#2E7D32]/10 px-5 py-3 text-sm font-bold text-[#2E7D32] ${className}`}
			>
				<CheckCircle2 className="h-4 w-4" aria-hidden="true" />
				App already installed
			</div>
		);
	}

	// Real one-tap install: browser fired beforeinstallprompt and handed us a
	// deferred prompt we can trigger directly from a user gesture.
	if (canPrompt) {
		return (
			<button
				onClick={async () => {
					setInstalling(true);
					await promptInstall();
					setInstalling(false);
				}}
				disabled={installing}
				className={`inline-flex items-center justify-center gap-2 rounded-2xl bg-[#1976D2] px-5 py-3 text-sm font-bold text-white shadow-md transition-colors hover:bg-[#0B1F3A] active:scale-[0.98] disabled:opacity-70 ${className}`}
			>
				<Download className="h-4 w-4" aria-hidden="true" />
				{installing ? 'Opening install dialog…' : 'Install App'}
			</button>
		);
	}

	// No deferred prompt (yet, or the engine never fires one). Chromium
	// browsers can still pick it up a moment later on this same screen; other
	// engines (Safari, Firefox) never support the automatic dialog, so we
	// hand the user exact manual steps instead of a dead button.
	return (
		<div className={className}>
			<button
				onClick={() => setShowHint((v) => !v)}
				aria-expanded={showHint}
				className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-[#1976D2] px-5 py-3 text-sm font-bold text-[#1976D2] transition-colors hover:bg-[#EAF2FB] active:scale-[0.98]"
			>
				<Info className="h-4 w-4" aria-hidden="true" />
				How to install
			</button>
			{showHint && (
				<p className="mt-2 rounded-xl bg-[#EAF2FB] px-4 py-3 text-xs leading-relaxed text-[#0B1F3A]">
					{supportsAutoPrompt
						? "This browser hasn't offered the automatic install dialog yet. "
						: ''}
					{instructions}
				</p>
			)}
		</div>
	);
}
