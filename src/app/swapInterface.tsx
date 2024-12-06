'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Check, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

import { SwapIntent } from '@/lib/types';

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

const SwapInterface: React.FC<SwapIntent> = ({ ...props }) => {
	const [state, setState] = useState<'init' | 'processing' | 'success'>('init');

	useEffect(() => {
		const timer = setTimeout(() => {
			setState('processing');
			const interval = setInterval(() => {
				clearInterval(interval);
				setState('success');
			}, 300);
			return () => clearInterval(interval);
		}, 1000);

		return () => clearTimeout(timer);
	}, []);

	return (
		<Card className="mx-auto w-full max-w-lg bg-gradient-to-br from-gray-100 to-gray-200 text-black shadow-xl">
			<CardContent className="p-6">
				<div className="mb-6 flex items-center justify-between">
					<div className="flex items-center space-x-4">
						<div className="rounded-lg bg-blue-500 p-2">
							<BlockchainIcon className="h-6 w-6 text-white" />
						</div>
						<div>
							<h3 className="text-lg font-semibold">Swapping Tokens</h3>
							<p className="text-sm text-gray-700">
								Swapping {props.amount} {props.fromToken} to {props.toToken} tokens
							</p>
						</div>
					</div>
					<StatusIndicator state={state} />
				</div>

				<div className="mb-4 flex items-center justify-between text-sm text-gray-600">
					<div className="flex items-center gap-1">
						<span>Via</span>
						<span className="font-semibold text-blue-600">Uniswap</span>
					</div>
					<div className="flex items-center gap-1">
						<span>on</span>
						<span className="font-semibold text-blue-600">{props.chain || 'Ethereum'}</span>
					</div>
				</div>

				<div className="space-y-6">
					<div className="flex items-center justify-between">
						<TokenNode label={props.fromToken} />
						<TransferAnimation state={state} />
						<TokenNode label={props.toToken} />
					</div>
				</div>
			</CardContent>
		</Card>
	);
};

const StatusIndicator = ({ state }: { state: 'init' | 'processing' | 'success' }) => {
	return (
		<div className="flex items-center space-x-2 rounded-full bg-gray-300 px-3 py-1">
			{state === 'init' && <div className="h-2 w-2 rounded-full bg-yellow-500" />}
			{state === 'processing' && <Loader2 className="h-4 w-4 animate-spin text-blue-600" />}
			{state === 'success' && <Check className="h-4 w-4 text-green-600" />}
			<span className="text-sm font-medium capitalize">{state}</span>
		</div>
	);
};

const TokenNode = ({ label }: { label: string }) => (
	<div className="flex flex-col items-center">
		<motion.div
			className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-purple-300 to-purple-500"
			whileHover={{ scale: 1.1 }}
			transition={{ type: 'spring', stiffness: 400, damping: 10 }}
		>
			<span className="text-sm font-bold text-white">{label.substring(0, 3)}</span>
		</motion.div>
	</div>
);

const TransferAnimation = ({ state }: { state: 'init' | 'processing' | 'success' }) => {
	const variants = {
		init: { pathLength: 0, opacity: 0.5 },
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
					initial="init"
					animate={state}
					variants={variants}
				/>
			</svg>
		</div>
	);
};

export default SwapInterface;
