'use client';

import React, { useState, useEffect } from 'react';
import { Wallet, Coins, Loader2, Check, X, ExternalLink } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { motion } from 'framer-motion';

interface BalanceIntent {
    intent: string;
    address: string;
    chain: string;
    tokens?: string[];
    executorResult: string;
}

const BalanceInterface: React.FC<BalanceIntent> = ({
    intent,
    address,
    chain,
    tokens,
    executorResult
}) => {
    const [state, setState] = useState<'processing' | 'success' | 'fail'>('processing');
    const [balances, setBalances] = useState<Record<string, string>>({});
    const [prevExecutorResult, setPrevExecutorResult] = useState('');

    useEffect(() => {
        if (
            executorResult === '' ||
            executorResult === undefined ||
            executorResult === null ||
            executorResult === prevExecutorResult
        ) {
            return;
        }

        try {
            const parsedResult = JSON.parse(executorResult);
            setState(parsedResult.status || 'fail');
            
            const { status, ...balanceData } = parsedResult;
            setBalances(balanceData);
        } catch (error) {
            console.error('Error parsing executor result:', error);
            setState('fail');
        }

        setPrevExecutorResult(executorResult);
    }, [executorResult, prevExecutorResult]);

    return (
        <Card className="mx-auto w-full max-w-md bg-white shadow-xl dark:bg-gray-900">
            <CardContent className="p-8">
                <div className="mb-8 text-center">
                    <h2 className="mb-2 text-2xl font-bold text-gray-900 dark:text-white">
                        Balance Check
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        Checking balances on {chain}
                    </p>
                </div>

                <div className="space-y-6">
                    {/* Address Section */}
                    <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-800">
                        <label className="mb-2 block text-sm font-medium text-gray-600 dark:text-gray-400">
                            Wallet Address
                        </label>
                        <div className="flex items-center space-x-3">
                            <div className="rounded-full bg-blue-100 p-2 dark:bg-blue-900">
                                <Wallet className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                            </div>
                            <span className="font-mono text-sm text-gray-800 dark:text-gray-200">
                                {address}
                            </span>
                        </div>
                    </div>

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
                                        className="flex items-center justify-between rounded-md bg-white p-3 shadow-sm dark:bg-gray-700"
                                    >
                                        <div className="flex items-center space-x-3">
                                            <div className="rounded-full bg-purple-100 p-2 dark:bg-purple-900">
                                                <Coins className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                                            </div>
                                            <span className="font-medium text-gray-900 dark:text-white">
                                                {token}
                                            </span>
                                        </div>
                                        <span className="text-gray-600 dark:text-gray-300">
                                            {balance}
                                        </span>
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
