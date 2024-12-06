'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Check, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { TransferIntent } from '@/lib/types';

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

const TransferInterface: React.FC<TransferIntent> = ({
	intent,
	amount,
	fromToken,
	receiverAddress
}) => {
	const [state, setState] = useState<'init' | 'processing' | 'success'>('init');
	const [progress, setProgress] = useState(0);

	useEffect(() => {
		const timer = setTimeout(() => {
			setState('processing');
			const interval = setInterval(() => {
				setProgress((prev) => {
					if (prev >= 100) {
						clearInterval(interval);
						setState('success');
						return 100;
					}
					return prev + 10;
				});
			}, 300);
			return () => clearInterval(interval);
		}, 1000);

		return () => clearTimeout(timer);
	}, []);

	return (
		<Card className="mx-auto w-full max-w-md bg-white shadow-xl dark:bg-gray-900">
			<CardContent className="p-8">
				<div className="mb-8 text-center">
					<h2 className="mb-2 text-2xl font-bold text-gray-900 dark:text-white">
						{intent === 'transfer' ? 'Transfer Funds' : 'Transaction'}
					</h2>
					<p className="text-sm text-gray-500 dark:text-gray-400">
						Sending {amount} {fromToken} to recipient
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
										{amount} {fromToken}
									</span>
									<span className="text-sm text-gray-500 dark:text-gray-400">Token Transfer</span>
								</div>
							</div>
						</div>
					</div>

					{/* Transfer Arrow */}
					<div className="flex justify-center">
						<div className="rounded-full bg-gray-100 p-2 dark:bg-gray-800">
							<ArrowRight className="h-6 w-6 text-gray-400 dark:text-gray-500" />
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
										{receiverAddress.substring(0, 6)}...
										{receiverAddress.substring(receiverAddress.length - 4)}
									</span>
									<span className="text-sm text-gray-500 dark:text-gray-400">
										Receiving {fromToken}
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
					</div>
				</div>
			</CardContent>
		</Card>
	);
};

const StatusIndicator = ({ state }: { state: 'init' | 'processing' | 'success' }) => {
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
		</div>
	);
};

export default TransferInterface;
