'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Check, Loader2, X } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { BridgeIntent } from '@/lib/types';

const BlockchainIcon = ({ className }: { className?: string }) => (
	<svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
		<path
			d="M15 5H9V9H15V5Z"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
		/>
		<path
			d="M9 15H15V19H9V15Z"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
		/>
		<path
			d="M5 9H9V15H5V9Z"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
		/>
		<path
			d="M15 9H19V15H15V9Z"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
		/>
	</svg>
);

const TransferWidget: React.FC<BridgeIntent & { executorResult: string }> = ({ 
	intent,
	amount,
	asset,
	fromNetwork,
	toNetwork,
	executorResult
}) => {
	const [state, setState] = useState<'processing' | 'success' | 'fail'>('processing');
	const [progress, setProgress] = useState(0);
	const [prevExecutorResult, setPrevExecutorResult] = useState('');
	const [txnUrl, setTxnUrl] = useState<string | null>(null);

	async function analyzeExecutorResult(executorResult: string) {
		console.log(executorResult, 'executorResult');
		if (executorResult === '') {
			return;
		}
		try {
			const chatCompletion = await openai.chat.completions.create({
				model: 'gpt-4o-mini',
				messages: [
					{
						role: 'user',
						content: `Analyze the following string and determine if it indicates success or failure, if it has a transaction and says successful respond with success, if it has a transaction and says failed respond with fail, if it has no transaction and says successful respond with success, if it has no transaction and says failed respond with fail, Respond with a json object for {"status": "success" or "fail", "txnUrl": "url" if it has a transaction, otherwise "txnUrl": null} only give the json object, don't type "json" or use backticks:\n\n"${executorResult}"`
					}
				]
			});

			const result = chatCompletion.choices[0].message.content;
			console.log(result, 'result');
			const parsedResult = JSON.parse(result ?? '');
			setState(parsedResult.status as 'success' | 'fail');
			if (parsedResult.status === 'success') {
				setProgress(100);
				setTxnUrl(parsedResult.txnUrl);
			} else {
				setProgress(0);
				setTxnUrl(null);
			}
		} catch (error) {
			console.error('Error analyzing executor result:', error);
			setState('fail');
		}
	}

	useEffect(() => {
		if (
			executorResult === '' ||
			executorResult === undefined ||
			executorResult === null ||
			executorResult === prevExecutorResult
		) {
			return;
		}
		analyzeExecutorResult(executorResult);
		setPrevExecutorResult(executorResult);
	}, [executorResult, prevExecutorResult]);

	return (
		<Card className="mx-auto w-full max-w-md bg-gradient-to-br from-gray-900 to-gray-800 text-white shadow-xl">
			<CardContent className="p-6">
				<div className="mb-6 flex items-center justify-between">
					<div className="flex items-center space-x-4">
						<div className="rounded-lg bg-blue-500 p-2">
							<BlockchainIcon className="h-6 w-6 text-white" />
						</div>
						<div>
							<h3 className="text-lg font-semibold">Bridging Assets</h3>
							<p className="text-sm text-gray-300">
								Bridging {amount} to {toNetwork}
							</p>
						</div>
					</div>
					<StatusIndicator state={state} />
				</div>
				<div className="space-y-6">
					<div className="flex items-center justify-between">
						<BlockchainNode label={fromNetwork} />
						<TransferAnimation state={state} />
						<BlockchainNode label={toNetwork} />
					</div>
					<Progress value={progress} className="h-2 w-full" />
				</div>
			</CardContent>
		</Card>
	);
};

const StatusIndicator = ({ state }: { state: 'processing' | 'success' | 'fail' }) => {
	return (
		<div className="flex items-center space-x-2 rounded-full bg-gray-700 px-3 py-1">
			{state === 'processing' && <Loader2 className="h-4 w-4 animate-spin text-blue-400" />}
			{state === 'success' && <Check className="h-4 w-4 text-green-400" />}
			{state === 'fail' && <X className="h-4 w-4 text-red-400" />}
			<span className="text-sm font-medium capitalize">{state}</span>
		</div>
	);
};

const BlockchainNode = ({ label }: { label: string }) => (
	<div className="flex flex-col items-center">
		<motion.div
			className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-blue-400 to-blue-600"
			whileHover={{ scale: 1.1 }}
			transition={{ type: 'spring', stiffness: 400, damping: 10 }}
		>
			<BlockchainIcon className="h-6 w-6 text-white" />
		</motion.div>
		<span className="mt-2 text-sm font-medium text-gray-300">{label}</span>
	</div>
);

const TransferAnimation = ({ state }: { state: 'processing' | 'success' | 'fail' }) => {
	const variants = {
		processing: {
			pathLength: 1,
			opacity: 1,
			transition: { duration: 2, repeat: Infinity, ease: 'easeInOut' }
		},
		success: { pathLength: 1, opacity: 1 }
	};

	return (
		<div className="relative mx-4 flex-1">
			<svg className="h-8 w-full" viewBox="0 0 200 20">
				<motion.path
					d="M 0 10 L 200 10"
					stroke="#3B82F6"
					strokeWidth="4"
					fill="none"
					initial="processing"
					animate={state}
					variants={variants}
				/>
			</svg>
			<motion.div
				className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 transform"
				initial={{ scale: 0 }}
				animate={
					state === 'processing'
						? { scale: [0.8, 1.2, 0.8], transition: { repeat: Infinity, duration: 2 } }
						: { scale: 1 }
				}
			>
				<ArrowRight className="text-blue-400" size={24} />
			</motion.div>
		</div>
	);
};

export default TransferWidget;
