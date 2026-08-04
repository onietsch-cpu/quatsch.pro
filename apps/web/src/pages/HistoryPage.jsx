import { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Trash2, History as HistoryIcon } from 'lucide-react';
import { clearHistory, getHistory } from '@/lib/storage';

export default function HistoryPage() {
	const [entries, setEntries] = useState([]);

	useEffect(() => {
		setEntries(getHistory());
	}, []);

	return (
		<div className="mx-auto w-full max-w-lg px-5 pb-16 pt-8">
			<Helmet>
				<title>CE Translator – History</title>
			</Helmet>

			<div className="flex items-center justify-between">
				<h1 className="text-2xl font-extrabold tracking-tight text-[#0B1F3A] dark:text-white">History</h1>
				{entries.length > 0 && (
					<button
						onClick={() => {
							clearHistory();
							setEntries([]);
						}}
						className="inline-flex items-center gap-1.5 rounded-xl border border-[#C62828]/40 px-3 py-2 text-xs font-semibold text-[#C62828] transition-colors hover:bg-[#C62828]/5"
					>
						<Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
						Clear
					</button>
				)}
			</div>

			{entries.length === 0 ? (
				<div className="mt-8 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center dark:border-white/10 dark:bg-[#0F2A4A]">
					<HistoryIcon className="h-8 w-8 text-slate-300" aria-hidden="true" />
					<p className="text-sm text-slate-500 dark:text-white/60">
						No saved translations yet. Enable “Save conversation history locally” in
						Settings and translate something – the last 20 entries will appear here.
					</p>
				</div>
			) : (
				<ul className="mt-6 space-y-3">
					{entries.map((entry) => (
						<li
							key={entry.id}
							className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-[#0F2A4A]"
						>
							<p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
								{entry.detectedLanguageName || 'Unknown'} → {entry.targetName}
							</p>
							<p className="mt-1 text-sm text-slate-700 dark:text-white/80">{entry.original}</p>
							<p className="mt-1 text-base font-semibold text-[#0B1F3A] dark:text-white">
								{entry.translation}
							</p>
							<p className="mt-2 text-[11px] text-slate-400">
								{new Date(entry.at).toLocaleString('en-US')}
							</p>
						</li>
					))}
				</ul>
			)}
		</div>
	);
}
