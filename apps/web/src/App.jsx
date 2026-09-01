import React, { lazy, Suspense, useEffect } from 'react';
import { Route, Routes, BrowserRouter as Router } from 'react-router-dom';
import ScrollToTop from './components/ScrollToTop';
import Layout from './components/Layout';
import { getSettings } from '@/lib/storage';
import { checkApiHealth } from '@/lib/apiHealth';

const HomePage = lazy(() => import('./pages/HomePage'));
const ConversationPage = lazy(() => import('./pages/ConversationPage'));
const HistoryPage = lazy(() => import('./pages/HistoryPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));

function PageFallback() {
	return (
		<div className="flex min-h-[60dvh] items-center justify-center bg-slate-50 px-6 text-sm font-semibold text-slate-500">
			Loading …
		</div>
	);
}

function withSuspense(page) {
	return <Suspense fallback={<PageFallback />}>{page}</Suspense>;
}

function useThemeBootstrap() {
	useEffect(() => {
		const apply = () => {
			const { theme } = getSettings();
			const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
			const dark = theme === 'dark' || (theme === 'system' && prefersDark);
			document.documentElement.classList.toggle('dark', dark);
		};
		apply();
		const mq = window.matchMedia('(prefers-color-scheme: dark)');
		mq.addEventListener('change', apply);
		return () => mq.removeEventListener('change', apply);
	}, []);
}

// Warms up the backend on load and again when the tab/network comes back,
// so the first real translation never hits a cold or sleeping API server.
function useApiWarmup() {
	useEffect(() => {
		const ping = () => {
			checkApiHealth();
		};
		ping();
		const onVisible = () => {
			if (document.visibilityState === 'visible') ping();
		};
		document.addEventListener('visibilitychange', onVisible);
		window.addEventListener('online', ping);
		return () => {
			document.removeEventListener('visibilitychange', onVisible);
			window.removeEventListener('online', ping);
		};
	}, []);
}

function App() {
	useThemeBootstrap();
	useApiWarmup();
	return (
		<Router>
			<ScrollToTop />
			<Routes>
				<Route element={<Layout />}>
					<Route path="/" element={withSuspense(<HomePage />)} />
					<Route path="/conversation" element={withSuspense(<ConversationPage />)} />
					<Route path="/history" element={withSuspense(<HistoryPage />)} />
					<Route path="/settings" element={withSuspense(<SettingsPage />)} />
				</Route>
			</Routes>
		</Router>
	);
}

export default App;
