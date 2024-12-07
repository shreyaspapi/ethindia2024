'use client';

import { useRef, useState } from 'react';
import { Mic, MicOff } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function AudioVisualizer({
	toggleRecording,
	disabled
}: {
	toggleRecording: () => void;
	disabled: boolean;
}) {
	const audioContextRef = useRef<AudioContext | null>(null);
	const analyserRef = useRef<AnalyserNode | null>(null);
	const [isListening, setIsListening] = useState(false);
	const [showVisualizer, setShowVisualizer] = useState(false);

	const startListening = async () => {
		toggleRecording();
		if (!audioContextRef.current) {
			audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
			analyserRef.current = audioContextRef.current.createAnalyser();
			analyserRef.current.fftSize = 64; // Smaller size for 5 distinct frequency bands
		}

		try {
			const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
			const source = audioContextRef.current.createMediaStreamSource(stream);
			source.connect(analyserRef.current);
			setIsListening(true);
			setShowVisualizer(true);
		} catch (error) {
			console.error('Error accessing microphone:', error);
		}
	};

	const stopListening = () => {
		toggleRecording();
		if (audioContextRef.current) {
			audioContextRef.current.close();
			audioContextRef.current = null;
		}
		setIsListening(false);
		setShowVisualizer(false);
	};

	return (
		<div className="flex flex-col items-center justify-center rounded-lg bg-black">
			<div className="flex items-center justify-between rounded-lg bg-zinc-800 p-2 px-4">
				<Button
					onClick={isListening ? stopListening : startListening}
					variant="ghost"
					size="icon"
					className="text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
					disabled={disabled}
				>
					{isListening ? <MicOff className="h-5 w-5 text-red-500" /> : <Mic className="h-5 w-5" />}
				</Button>
				<div
					className={`flex justify-center gap-1 transition-all duration-300 ease-in-out ${showVisualizer ? 'w-24 opacity-100' : 'w-0 opacity-0'} overflow-hidden`}
				>
					{Array.from({ length: 6 }).map((_, i) => (
						<div
							key={i}
							className="h-1 w-1 animate-pulse rounded-full bg-white"
							style={{
								animationDelay: `${i * 0.15}s`
							}}
						/>
					))}
				</div>
			</div>
		</div>
	);
}
