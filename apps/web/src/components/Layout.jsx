import { useEffect, useState } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { Mic, MessagesSquare, History, Settings, WifiOff, Loader2 } from 'lucide-react';
import { checkApiHealth, wakeBackend } from '@/lib/apiHealth';

const NAV_ITEMS = [
	{ to: '/', label: 'Translate', icon: Mic, end: true },
	{ to: '/conversation', label: 'Conversation', icon: MessagesSquare },
	{ to: '/history', label: 'History', icon: History },
	{ to: '/settings', label: 'Settings', icon: Settings },
];

function useOnlineStatus() {
	const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
	useEffect(() => {
		const on = () => setOnline(true);
		const off = () => setOnline(false);
		window.addEventListener('online', on);
		window.addEventListener('offline', off);
		return () => {
			window.removeEventListener('online', on);
			window.removeEventListener('offline', off);
		};
	}, []);
	return online;
}

// 'ok' | 'waking' | 'down' — the sandbox backend hibernates when idle, so we
// wake it on load / tab focus and tell the user while it boots.
function useBackendStatus(online) {
	const [status, setStatus] = useState('ok');

	useEffect(() => {
		let cancelled = false;

		const probe = async () => {
			if (!navigator.onLine) return;
			if (await checkApiHealth()) {
				if (!cancelled) setStatus('ok');
				return;
			}
			if (cancelled) return;
			setStatus('waking');
			const up = await wakeBackend({ timeoutMs: 45000 });
			if (!cancelled) setStatus(up ? 'ok' : 'down');
		};

		probe();
		const onVisible = () => {
			if (document.visibilityState === 'visible') probe();
		};
		document.addEventListener('visibilitychange', onVisible);
		window.addEventListener('online', probe);
		const interval = setInterval(probe, 120000);

		return () => {
			cancelled = true;
			clearInterval(interval);
			document.removeEventListener('visibilitychange', onVisible);
			window.removeEventListener('online', probe);
		};
	}, [online]);

	return status;
}

export default function Layout() {
	const online = useOnlineStatus();
	const backend = useBackendStatus(online);

	return (
		<div className="flex min-h-[100dvh] flex-col bg-[#F7F9FC] dark:bg-[#0B1F3A]">
			{!online && (
				<div
					role="status"
					className="flex items-center justify-center gap-2 bg-[#C62828] px-4 py-2 text-center text-sm font-semibold text-white"
				>
					<WifiOff className="h-4 w-4 shrink-0" aria-hidden="true" />
					You are offline. The app can still be opened, but an internet connection is required for
					new translations.
				</div>
			)}

			{online && backend === 'waking' && (
				<div role="status" className="flex items-center justify-center gap-2 bg-[#F59E0B] px-4 py-2 text-center text-sm font-semibold text-[#0B1F3A]">
					<Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />
					The translation service is starting up — this takes a few seconds.
				</div>
			)}

			{online && backend === 'down' && (
				<div role="status" className="flex items-center justify-center gap-2 bg-[#C62828] px-4 py-2 text-center text-sm font-semibold text-white">
					The translation service is temporarily unavailable. Please try again in a moment.
				</div>
			)}

			<nav
				aria-label="Main navigation"
				className="sticky top-0 z-20 hidden border-b border-[#0B1F3A]/10 bg-white/95 backdrop-blur md:block dark:bg-[#0B1F3A] dark:border-white/10"
			>
				<div className="mx-auto flex w-full max-w-4xl items-center justify-between px-6 py-3">
					<span className="text-lg font-extrabold tracking-tight text-[#0B1F3A] dark:text-white">
						CE Translator
					</span>
					<div className="flex items-center gap-1">
						{NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
							<NavLink
								key={to}
								to={to}
								end={end}
								className={({ isActive }) =>
									`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1976D2] ${
										isActive
											? 'bg-[#1976D2] text-white'
											: 'text-[#0B1F3A] hover:bg-[#EAF2FB] dark:text-white dark:hover:bg-white/10'
									}`
								}
							>
								<Icon className="h-4 w-4" aria-hidden="true" />
								{label}
							</NavLink>
						))}
					</div>
				</div>
			</nav>

			<main className="flex-1 pb-20 md:pb-0">
				<Outlet />
			</main>

			<nav
				aria-label="Main navigation"
				className="fixed inset-x-0 bottom-0 z-20 border-t border-[#0B1F3A]/10 bg-white/95 backdrop-blur md:hidden dark:bg-[#0B1F3A] dark:border-white/10"
			>
				<div className="mx-auto grid w-full max-w-lg grid-cols-4">
					{NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
						<NavLink
							key={to}
							to={to}
							end={end}
							className={({ isActive }) =>
								`flex min-h-[56px] flex-col items-center justify-center gap-1 py-2 text-[11px] font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1976D2] ${
									isActive ? 'text-[#1976D2]' : 'text-[#0B1F3A]/60 dark:text-white/60'
								}`
							}
						>
							<Icon className="h-5 w-5" aria-hidden="true" />
							{label}
						</NavLink>
					))}
				</div>
			</nav>
		</div>
	);
}
