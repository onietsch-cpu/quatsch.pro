import React, { useEffect } from 'react';
import { Route, Routes, BrowserRouter as Router } from 'react-router-dom';
import { SpeedInsights } from '@vercel/speed-insights/react';
import ScrollToTop from './components/ScrollToTop';
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import ConversationPage from './pages/ConversationPage';
import HistoryPage from './pages/HistoryPage';
import SettingsPage from './pages/SettingsPage';
import { getSettings } from '@/lib/storage';
import { checkApiHealth } from '@/lib/apiHealth';

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
					<Route path="/" element={<HomePage />} />
					<Route path="/conversation" element={<ConversationPage />} />
					<Route path="/history" element={<HistoryPage />} />
					<Route path="/settings" element={<SettingsPage />} />
				</Route>
			</Routes>
			<SpeedInsights />
		</Router>
	);
}

export default App;
