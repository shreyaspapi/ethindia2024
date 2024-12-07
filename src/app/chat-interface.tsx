'use client';
// @ts-nocheck

import React, { useState, useRef, useEffect } from 'react';
import { Plus, Power } from 'lucide-react';
import { Card } from '@/components/ui/card';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger
} from '@/components/ui/accordion';
import { Modality, RTClient, RTInputAudioItem, RTResponse, TurnDetection } from 'rt-client';
import { AudioHandler } from '@/lib/audio';
import { POLYGON_INSTRUCTION_MESSAGE } from '@/lib/defaults';
import { cn } from '@/lib/utils';
import { Intent } from '@/lib/types';
import BridgeInterface from './bridgeInterface';
import TransferInterface from './transferInterface';
import SwapInterface from './swapInterface';
import AudioVisualizer from './recordInteraction';
import { invokeExecutor } from '@/lib/cdp/config';

interface Message {
	type: 'user' | 'assistant' | 'status' | 'intent';
	content: string;
}

interface ToolDeclaration {
	name: string;
	parameters: string;
	returnValue: string;
}

const ChatInterface = () => {
	const [isAzure, setIsAzure] = useState(true);
	const [apiKey, setApiKey] = useState(process.env.NEXT_PUBLIC_AZURE_KEY ?? '');
	const [endpoint, setEndpoint] = useState(process.env.NEXT_PUBLIC_AZURE_ENDPOINT ?? '');
	const [deployment, setDeployment] = useState(process.env.NEXT_PUBLIC_DEPLOYMENT_NAME ?? '');
	const [useVAD, setUseVAD] = useState(true);
	const [instructions, setInstructions] = useState(POLYGON_INSTRUCTION_MESSAGE);
	const [temperature, setTemperature] = useState(0.6);
	const [modality, setModality] = useState('audio');
	const [tools, setTools] = useState<ToolDeclaration[]>([]);
	const [messages, setMessages] = useState<Message[]>([]);
	const [currentMessage, setCurrentMessage] = useState('');
	const [isRecording, setIsRecording] = useState(false);
	const [isConnected, setIsConnected] = useState(false);
	const [isConnecting, setIsConnecting] = useState(false);
	const clientRef = useRef<RTClient | null>(null);
	const audioHandlerRef = useRef<AudioHandler | null>(null);

	const addTool = () => {
		setTools([...tools, { name: '', parameters: '', returnValue: '' }]);
	};

	const updateTool = (index: number, field: string, value: string) => {
		const newTools = [...tools];

		if (field === 'name') {
			newTools[index].name = value;
		} else if (field === 'parameters') {
			newTools[index].parameters = value;
		} else if (field === 'returnValue') {
			newTools[index].returnValue = value;
		}
	};

	const handleConnect = async () => {
		if (!isConnected) {
			try {
				setIsConnecting(true);
				clientRef.current = isAzure
					? new RTClient(new URL(endpoint), { key: apiKey }, { deployment })
					: new RTClient({ key: apiKey }, { model: 'gpt-4o-realtime-preview-2024-10-01' });
				const modalities: Modality[] = modality === 'audio' ? ['text', 'audio'] : ['text'];
				const turnDetection: TurnDetection = useVAD ? { type: 'server_vad' } : null;
				clientRef.current.configure({
					instructions: instructions?.length > 0 ? instructions : undefined,
					input_audio_transcription: { model: 'whisper-1' },
					turn_detection: turnDetection,
					tools,
					temperature,
					modalities
				});
				startResponseListener();

				setIsConnected(true);
			} catch (error) {
				console.error('Connection failed:', error);
			} finally {
				setIsConnecting(false);
			}
		} else {
			await disconnect();
		}
	};

	const disconnect = async () => {
		if (clientRef.current) {
			try {
				await clientRef.current.close();
				clientRef.current = null;
				setIsConnected(false);
			} catch (error) {
				console.error('Disconnect failed:', error);
			}
		}
	};

	const handleResponse = async (response: RTResponse) => {
		for await (const item of response) {
			if (item.type === 'message' && item.role === 'assistant') {
				const message: Message = {
					type: item.role,
					content: ''
				};
				setMessages((prevMessages) => [...prevMessages, message]);
				for await (const content of item) {
					if (content.type === 'text') {
						for await (const text of content.textChunks()) {
							message.content += text;
							setMessages((prevMessages) => {
								prevMessages[prevMessages.length - 1].content = message.content;
								return [...prevMessages];
							});
						}
					} else if (content.type === 'audio') {
						const textTask = async () => {
							for await (const text of content.transcriptChunks()) {
								message.content += text;
								setMessages((prevMessages) => {
									prevMessages[prevMessages.length - 1].content = message.content;
									return [...prevMessages];
								});
							}
						};
						const audioTask = async () => {
							audioHandlerRef.current?.startStreamingPlayback();
							for await (const audio of content.audioChunks()) {
								audioHandlerRef.current?.playChunk(audio);
							}
						};
						await Promise.all([textTask(), audioTask()]);
					}
				}
			}
		}
		if (response.status === 'completed') {
			const hasJson = response.output[0]?.content[0].transcript.includes('{');
			const openingBracketIndex = response.output[0]?.content[0].transcript.indexOf('{');
			const closingBracketIndex = response.output[0]?.content[0].transcript.lastIndexOf('}');
			if (hasJson) {
				const messageContent = response.output[0]?.content[0].transcript.substring(
					openingBracketIndex,
					closingBracketIndex + 1
				);
				setMessages((prevMessages) =>
					prevMessages.map((message) =>
						message.content === messageContent ? { ...message, type: 'intent' } : message
					)
				);
			}
			console.log('messageContent', messageContent);
			getExecutorResult(messageContent);
		}
	};

	const handleInputAudio = async (item: RTInputAudioItem) => {
		audioHandlerRef.current?.stopStreamingPlayback();
		await item.waitForCompletion();
		setMessages((prevMessages) => [
			...prevMessages,
			{
				type: 'user',
				content: item.transcription || ''
			}
		]);
	};

	const startResponseListener = async () => {
		if (!clientRef.current) return;

		try {
			for await (const serverEvent of clientRef.current.events()) {
				if (serverEvent.type === 'response') {
					await handleResponse(serverEvent);
				} else if (serverEvent.type === 'input_audio') {
					await handleInputAudio(serverEvent);
				}
			}
		} catch (error) {
			if (clientRef.current) {
				console.error('Response iteration error:', error);
			}
		}
	};

	const sendMessage = async () => {
		if (currentMessage.trim() && clientRef.current) {
			try {
				setMessages((prevMessages) => [
					...prevMessages,
					{
						type: 'user',
						content: currentMessage
					}
				]);

				await clientRef.current.sendItem({
					type: 'message',
					role: 'user',
					content: [{ type: 'input_text', text: currentMessage }]
				});
				await clientRef.current.generateResponse();
				setCurrentMessage('');
			} catch (error) {
				console.error('Failed to send message:', error);
			}
		}
	};

	const toggleRecording = async () => {
		if (!isRecording && clientRef.current) {
			try {
				if (!audioHandlerRef.current) {
					audioHandlerRef.current = new AudioHandler();
					await audioHandlerRef.current.initialize();
				}
				await audioHandlerRef.current.startRecording(async (chunk) => {
					await clientRef.current?.sendAudio(chunk);
				});
				setIsRecording(true);
			} catch (error) {
				console.error('Failed to start recording:', error);
			}
		} else if (audioHandlerRef.current) {
			try {
				audioHandlerRef.current.stopRecording();
				if (!useVAD) {
					const inputAudio = await clientRef.current?.commitAudio();
					await handleInputAudio(inputAudio!);
					await clientRef.current?.generateResponse();
				}
				setIsRecording(false);
			} catch (error) {
				console.error('Failed to stop recording:', error);
			}
		}
	};

	async function getExecutorResult(messageIntent: Intent) {
		await invokeExecutor(JSON.stringify(messageIntent));
	}

	const IntentUI: React.FC<Intent> = (messageIntent) => {
		switch (messageIntent.intent) {
			case 'bridge':
				return <BridgeInterface {...messageIntent} />;
			case 'transfer':
				return <TransferInterface {...messageIntent} />;
			case 'swap':
				return <SwapInterface {...messageIntent} />;
			default:
				return <pre>{JSON.stringify(messageIntent, null, 2)}</pre>;
		}
	};

	useEffect(() => {
		const initAudioHandler = async () => {
			const handler = new AudioHandler();
			await handler.initialize();
			audioHandlerRef.current = handler;
		};

		initAudioHandler().catch(console.error);

		return () => {
			disconnect();
			audioHandlerRef.current?.close().catch(console.error);
		};
	}, []);

	return (
		<div className="flex h-screen">
			{/* Parameters Panel */}
			<div className="flex w-80 flex-col border-r bg-gray-50 p-4">
				{process.env.NEXT_PUBLIC_DEBUG_MODE === 'on' && (
					<div className="flex-1 overflow-y-auto">
						<Accordion type="single" collapsible className="space-y-4">
							{/* Connection Settings */}
							<AccordionItem value="connection">
								<AccordionTrigger className="text-lg font-semibold">
									Connection Settings
								</AccordionTrigger>
								<AccordionContent className="space-y-4">
									<div className="flex items-center justify-between">
										<span>Use Azure OpenAI</span>
										<Switch checked={isAzure} onCheckedChange={setIsAzure} disabled={isConnected} />
									</div>

									{isAzure && (
										<>
											<Input
												placeholder="Azure Endpoint"
												value={endpoint}
												onChange={(e) => setEndpoint(e.target.value)}
												disabled={isConnected}
											/>
											<Input
												placeholder="Deployment Name"
												value={deployment}
												onChange={(e) => setDeployment(e.target.value)}
												disabled={isConnected}
											/>
										</>
									)}

									<Input
										type="password"
										placeholder="API Key"
										value={apiKey}
										onChange={(e) => setApiKey(e.target.value)}
										disabled={isConnected}
									/>
								</AccordionContent>
							</AccordionItem>

							{/* Conversation Settings */}
							<AccordionItem value="conversation">
								<AccordionTrigger className="text-lg font-semibold">
									Conversation Settings
								</AccordionTrigger>
								<AccordionContent className="space-y-4">
									<div className="flex items-center justify-between">
										<span>Use Server VAD</span>
										<Switch checked={useVAD} onCheckedChange={setUseVAD} disabled={isConnected} />
									</div>
									<div className="space-y-2">
										<label className="text-sm font-medium">Instructions</label>
										<textarea
											className="min-h-[100px] w-full rounded border p-2"
											value={instructions}
											onChange={(e) => setInstructions(e.target.value)}
											disabled={isConnected}
										/>
									</div>

									<div className="space-y-2">
										<label className="text-sm font-medium">Tools</label>
										{tools.map((tool, index) => (
											<Card key={index} className="p-2">
												<Input
													placeholder="Function name"
													value={tool.name}
													onChange={(e) => updateTool(index, 'name', e.target.value)}
													className="mb-2"
													disabled={isConnected}
												/>
												<Input
													placeholder="Parameters"
													value={tool.parameters}
													onChange={(e) => updateTool(index, 'parameters', e.target.value)}
													className="mb-2"
													disabled={isConnected}
												/>
												<Input
													placeholder="Return value"
													value={tool.returnValue}
													onChange={(e) => updateTool(index, 'returnValue', e.target.value)}
													disabled={isConnected}
												/>
											</Card>
										))}
										<Button
											variant="outline"
											size="sm"
											onClick={addTool}
											className="w-full"
											disabled={isConnected || true}
										>
											<Plus className="mr-2 h-4 w-4" />
											Add Tool
										</Button>
									</div>

									<div className="space-y-2">
										<label className="text-sm font-medium">Temperature ({temperature})</label>
										<Slider
											value={[temperature]}
											onValueChange={([value]) => setTemperature(value)}
											min={0.6}
											max={1.2}
											step={0.1}
											disabled={isConnected}
										/>
									</div>

									<div className="space-y-2">
										<label className="text-sm font-medium">Modality</label>
										<Select value={modality} onValueChange={setModality} disabled={isConnected}>
											<SelectTrigger>
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="text">Text</SelectItem>
												<SelectItem value="audio">Audio</SelectItem>
											</SelectContent>
										</Select>
									</div>
								</AccordionContent>
							</AccordionItem>
						</Accordion>
					</div>
				)}

				{/* Connect Button */}
				<Button
					className="mt-4"
					variant={isConnected ? 'destructive' : 'default'}
					onClick={handleConnect}
					disabled={isConnecting}
				>
					<Power className="mr-2 h-4 w-4" />
					{isConnecting ? 'Connecting...' : isConnected ? 'Disconnect' : 'Connect'}
				</Button>
			</div>

			{/* Chat Window */}
			<div className="flex flex-1 flex-col">
				{/* Messages Area */}
				<div className="flex-1 overflow-y-auto p-4">
					{messages.map((message, index) => (
						<div
							key={index}
							className={cn('mb-4 rounded-lg p-3', 'mr-auto max-w-[80%] bg-gray-100', {
								'ml-auto mr-0 max-w-[80%] bg-blue-100': message.type === 'user',
								'w-max': message.type === 'intent'
							})}
						>
							{message.type === 'intent' ? (
								<IntentUI {...JSON.parse(message.content)} />
							) : (
								message.content
							)}
						</div>
					))}
				</div>

				{/* Input Area */}
				<div className="border-t p-4">
					<div className="flex justify-center">
						<Input
							value={currentMessage}
							onChange={(e) => setCurrentMessage(e.target.value)}
							placeholder="Type your message..."
							onKeyUp={(e) => e.key === 'Enter' && sendMessage()}
							disabled={!isConnected}
						/>
						<AudioVisualizer toggleRecording={toggleRecording} disabled={!isConnected} />
					</div>
				</div>
			</div>
		</div>
	);
};

export default ChatInterface;
