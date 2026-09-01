import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import StartScreen from '@/components/StartScreen';
import { getLanguageByCode } from '@/lib/languages';
import { stopSpeaking } from '@/lib/speech';

const STORAGE_KEY = 'translator_session_single';
const LanguageSelector = lazy(() => import('@/components/LanguageSelector'));
const DialogView = lazy(() => import('@/components/DialogView'));

function FlowFallback() {
	return (
		<div className="flex min-h-[60dvh] items-center justify-center bg-slate-50 px-6 text-sm font-semibold text-slate-500">
			Loading …
		</div>
	);
}

function isValidSession(session) {
	if (!session || typeof session !== 'object') return false;
	return session.mode === 'single' && Boolean(getLanguageByCode(session.targetCode));
}

export default function HomePage() {
	// 'start' | 'select' | 'dialog'
	const [stage, setStage] = useState('start');
	const [session, setSession] = useState(null);

	// Restore an active session from sessionStorage (survives an accidental reload).
	useEffect(() => {
		try {
			const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || 'null');
			if (isValidSession(saved)) {
				setSession(saved);
				setStage('dialog');
			}
		} catch {
			/* noop */
		}
	}, []);

	const handleStart = useCallback(() => setStage('select'), []);

	const handleConfirmLanguage = useCallback((selection) => {
		if (!isValidSession(selection)) return;
		try {
			sessionStorage.setItem(STORAGE_KEY, JSON.stringify(selection));
		} catch {
			/* noop */
		}
		setSession(selection);
		setStage('dialog');
	}, []);

	const handleEndDialog = useCallback(() => {
		stopSpeaking();
		try {
			sessionStorage.removeItem(STORAGE_KEY);
		} catch {
			/* noop */
		}
		setSession(null);
		setStage('start');
	}, []);

	const handleCancelSelect = useCallback(() => setStage('start'), []);

	return (
		<>
			<Helmet>
				<title>CE Translator – Translate</title>
				<meta
					name="description"
					content="CE Translator: instantly detect speech or text and translate it into the selected target language."
				/>
			</Helmet>

			{stage === 'start' && <StartScreen onStart={handleStart} />}
			<Suspense fallback={<FlowFallback />}>
				{stage === 'select' && (
					<LanguageSelector onConfirm={handleConfirmLanguage} onCancel={handleCancelSelect} forceMode="single" />
				)}
				{stage === 'dialog' && session && (
					<DialogView key={session.targetCode} mode="single" targetCode={session.targetCode} onEndDialog={handleEndDialog} />
				)}
			</Suspense>
		</>
	);
}
