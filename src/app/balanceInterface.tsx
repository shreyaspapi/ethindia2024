'use client';

import React, { useState, useEffect } from 'react';
import { Wallet, Coins, Loader2, Check, X } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { motion } from 'framer-motion';
import { OpenAI } from 'openai';

interface BalanceIntent {
	intent: string;
	executorResult: string;
}

const openai = new OpenAI({
	apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY,
	dangerouslyAllowBrowser: true
});

const BalanceInterface: React.FC<BalanceIntent & { executorResult: string }> = ({
	intent,
	executorResult
}) => {
	const [state, setState] = useState<'processing' | 'success' | 'fail'>('processing');
	const [balances, setBalances] = useState<string[]>([]);
	const [prevExecutorResult, setPrevExecutorResult] = useState('');

	async function analyzeExecutorResult(executorResult: string) {
		setState('processing');
		console.log(executorResult, 'executorResult');
		let executorResultString = executorResult;
		if (executorResult === '') {
			return;
		}
		if (typeof executorResult !== 'string') {
			executorResultString = JSON.stringify(executorResult);
		}
		try {
			const chatCompletion = await openai.chat.completions.create({
				model: 'gpt-4o',
				messages: [
					{
						role: 'user',
						content: `Analyze the following string and determine if it indicates success or failure, if it has a balance respond with success, else respond with fail. Respond with a json object for {"status": "success" or "fail", "balances": [balances]} only give the json object, don't type "json" or use backticks:\n\n"${executorResultString}"`
					}
				]
			});

			const result = chatCompletion.choices[0].message.content;
			console.log(result, 'result');
			const parsedResult = JSON.parse(result ?? '');
			setState('success');
			setBalances(parsedResult.balances);
		} catch (error) {
			console.error('Error analyzing executor result:', error);
			setState('fail');
			setBalances([]);
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
					<h2 className="mb-2 text-2xl font-bold text-gray-900 dark:text-white">Balance Check</h2>
					<p className="text-sm text-gray-500 dark:text-gray-400">
						Checking balances on Base Sepolia{' '}
					</p>
				</div>

				<div className="space-y-6">
					{/* Address Section */}
					{/* <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-800">
						<label className="mb-2 block text-sm font-medium text-gray-600 dark:text-gray-400">
							Token Balances
						</label>
						<div className="flex items-center space-x-3">

							<div className="rounded-full bg-blue-100 p-2 dark:bg-blue-900">
								<Wallet className="h-5 w-5 text-blue-600 dark:text-blue-400" />
							</div>
						</div>

					</div> */}

					{/* Balances Section */}
					<div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-800">
						<div className="mb-2 flex items-center justify-between">
							<label className="text-sm font-medium text-gray-600 dark:text-gray-400">
								Token Balances
							</label>
							<StatusIndicator state={state} />
						</div>

						<div className="space-y-3">
							{state === 'processing' ? (
								<div className="flex justify-center py-4">
									<Loader2 className="h-8 w-8 animate-spin text-blue-500" />
								</div>
							) : (
								Object.entries(balances).map(([token, balance]) => (
									<motion.div
										key={token}
										initial={{ opacity: 0, y: 20 }}
										animate={{ opacity: 1, y: 0 }}
										className="flex items-center rounded-md bg-white p-3 shadow-sm dark:bg-gray-700"
									>
										<div className="flex items-center space-x-3">
											{/* <div className="rounded-full bg-purple-100 p-2 dark:bg-purple-900">
												<Coins className="h-4 w-4 text-purple-600 dark:text-purple-400" />
											</div> */}
										</div>
										<span className="text-gray-600 dark:text-gray-300">{balance}</span>
									</motion.div>
								))
							)}
						</div>
					</div>
				</div>
			</CardContent>
		</Card>
	);
};

const StatusIndicator = ({ state }: { state: 'processing' | 'success' | 'fail' }) => {
	return (
		<div className="flex items-center space-x-2 text-sm">
			{state === 'processing' && (
				<div className="flex items-center space-x-1 text-blue-500">
					<Loader2 className="h-3 w-3 animate-spin" />
					<span>Fetching</span>
				</div>
			)}
			{state === 'success' && (
				<div className="flex items-center space-x-1 text-green-500">
					<Check className="h-3 w-3" />
					<span>Updated</span>
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

export default BalanceInterface;
