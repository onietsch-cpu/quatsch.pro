import { useEffect, useState } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { Mic, MessagesSquare, History, Settings, WifiOff } from 'lucide-react';

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

export default function Layout() {
	const online = useOnlineStatus();

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
