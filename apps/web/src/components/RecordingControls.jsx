import { Pause, Play, Send, Square } from 'lucide-react';

export default function RecordingControls({ state, onPause, onResume, onStop, onTranslate }) {
	const capturing = state === 'recording' || state === 'paused';
	const paused = state === 'paused';
	return (
		<div className="mt-3 w-full space-y-2">
			<div className="grid grid-cols-2 gap-2">
				<button type="button" disabled={!capturing} onClick={paused ? onResume : onPause} className="flex items-center justify-center gap-2 rounded-xl border border-slate-300 px-3 py-3 font-semibold disabled:opacity-40">
					{paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
					{paused ? 'Resume recording' : 'Pause recording'}
				</button>
				<button type="button" disabled={!capturing} onClick={onStop} className="flex items-center justify-center gap-2 rounded-xl border border-slate-300 px-3 py-3 font-semibold disabled:opacity-40">
					<Square className="h-4 w-4" /> Stop recording
				</button>
			</div>
			<button type="button" disabled={!capturing && state !== 'stopped'} onClick={onTranslate} className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal-600 px-4 py-3 font-bold text-white disabled:opacity-40">
				<Send className="h-4 w-4" /> Start translation
			</button>
			<p role="status" className="text-center text-sm text-slate-600">
				{state === 'starting' ? 'Waiting for microphone access …' : state === 'transcribing' ? 'Transcribing …' : state === 'stopped' ? 'Recording stopped. Press Start translation when ready.' : paused ? 'Paused. Your recording is kept.' : 'No automatic stop. Translate when you are ready.'}
			</p>
		</div>
	);
}
