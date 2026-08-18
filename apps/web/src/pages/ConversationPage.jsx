import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import LanguageSelector from '@/components/LanguageSelector';
import ConversationView from '@/components/ConversationView';
import { getLanguageByCode } from '@/lib/languages';
import { stopSpeaking } from '@/lib/speech';

const STORAGE_KEY = 'translator_session_dialog';

function isValidSession(session) {
	if (!session || typeof session !== 'object') return false;
	return (
		session.mode === 'dialog' &&
		Boolean(getLanguageByCode(session.langACode)) &&
		Boolean(getLanguageByCode(session.langBCode))
	);
}

export default function ConversationPage() {
	// 'select' | 'dialog'
	const [stage, setStage] = useState('select');
	const [session, setSession] = useState(null);
	const navigate = useNavigate();

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
		setStage('select');
	}, []);

	return (
		<>
			<Helmet>
				<title>CE Translator – Conversation</title>
				<meta
					name="description"
					content="Manual conversation between two people: each translation direction starts only after an explicit button press, with no round limit."
				/>
			</Helmet>

			{stage === 'select' && (
				<LanguageSelector
					onConfirm={handleConfirmLanguage}
					onCancel={() => navigate('/')}
					forceMode="dialog"
				/>
			)}
			{stage === 'dialog' && session && (
				<ConversationView
					key={`${session.langACode}-${session.langBCode}`}
					langACode={session.langACode}
					langBCode={session.langBCode}
					onEndDialog={handleEndDialog}
				/>
			)}
		</>
	);
}
