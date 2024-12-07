'use client';

import React, { useState, useEffect } from 'react';
import { ArrowDown, Check, Loader2, X } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { TransferIntent } from '@/lib/types';

import { OpenAI } from 'openai';

const openai = new OpenAI({
	apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY, // Ensure your API key is set in the environment variables,
	dangerouslyAllowBrowser: true
});

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

const TransferInterface: React.FC<TransferIntent & { executorResult: string }> = ({
	intent,
	amount,
	asset,
	receiverAddress,
	chain,
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
		<Card className="mx-auto w-full max-w-md bg-white shadow-xl dark:bg-gray-900">
			<CardContent className="p-8">
				<div className="mb-8 text-center">
					<h2 className="mb-2 text-2xl font-bold text-gray-900 dark:text-white">
						Transferring Funds
					</h2>
					<p className="text-sm text-gray-500 dark:text-gray-400">
						Sending {amount} {asset} to recipient
					</p>
				</div>

				<div className="space-y-6">
					{/* Amount Section */}
					<div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-800">
						<label className="mb-2 block text-sm font-medium text-gray-600 dark:text-gray-400">
							Amount
						</label>
						<div className="flex items-center justify-between">
							<div className="flex items-center space-x-3">
								<div className="rounded-full bg-blue-100 p-2 dark:bg-blue-900">
									<BlockchainIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
								</div>
								<div className="flex flex-col">
									<span className="font-medium text-gray-900 dark:text-white">
										{amount} {asset}
									</span>
									<span className="text-sm text-gray-500 dark:text-gray-400">Token Transfer</span>
								</div>
							</div>
						</div>
					</div>

					{/* Transfer Arrow */}
					<div className="flex justify-center">
						<div className="rounded-full bg-gray-100 p-2 dark:bg-gray-800">
							<ArrowDown className="h-6 w-6 text-gray-400 dark:text-gray-500" />
						</div>
					</div>

					{/* Recipient Section */}
					<div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-800">
						<label className="mb-2 block text-sm font-medium text-gray-600 dark:text-gray-400">
							Recipient
						</label>
						<div className="flex items-center justify-between">
							<div className="flex items-center space-x-3">
								<div className="rounded-full bg-green-100 p-2 dark:bg-green-900">
									<BlockchainIcon className="h-5 w-5 text-green-600 dark:text-green-400" />
								</div>
								<div className="flex flex-col">
									<span className="font-mono text-sm text-gray-800 dark:text-gray-200">
										{receiverAddress}
									</span>
									<span className="text-sm text-gray-500 dark:text-gray-400">
										Receiving {asset} on {chain} chain
									</span>
								</div>
							</div>
						</div>
					</div>

					{/* Progress Section */}
					<div className="space-y-2">
						<div className="flex justify-between">
							<span className="text-sm text-gray-500 dark:text-gray-400">Transfer Status</span>
							<StatusIndicator state={state} />
						</div>
						<Progress value={progress} className="h-2 w-full bg-gray-100 dark:bg-gray-800" />
						{txnUrl && (
							<div className="mt-4 flex items-center justify-between">
								View Transaction:
								<a
									href={txnUrl}
									target="_blank"
									className="text-sm text-blue-600 hover:underline dark:text-blue-400"
								>
									{txnUrl.split('/').pop()?.slice(0, 10)}...{txnUrl.split('/').pop()?.slice(-10)}
								</a>
							</div>
						)}
					</div>
				</div>
			</CardContent>
		</Card>
	);
};

const StatusIndicator = ({ state }: { state: 'init' | 'processing' | 'success' | 'fail' }) => {
	return (
		<div className="flex items-center space-x-2 text-sm">
			{state === 'init' && (
				<div className="flex items-center space-x-1 text-yellow-500">
					<div className="h-2 w-2 rounded-full bg-yellow-500" />
					<span>Preparing</span>
				</div>
			)}
			{state === 'processing' && (
				<div className="flex items-center space-x-1 text-blue-500">
					<Loader2 className="h-3 w-3 animate-spin" />
					<span>Processing</span>
				</div>
			)}
			{state === 'success' && (
				<div className="flex items-center space-x-1 text-green-500">
					<Check className="h-3 w-3" />
					<span>Complete</span>
				</div>
			)}
			{state === 'fail' && (
				<div className="flex items-center space-x-1 text-red-500">
					<X className="h-3 w-3" />
					<span>Failed</span>
				</div>
			)}
		</div>
	);
};

export default TransferInterface;
