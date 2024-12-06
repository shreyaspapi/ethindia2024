export type Intent = BridgeIntent | TransferIntent | SwapIntent;

export type BridgeIntent = {
	intent: 'bridge';
	amount: string;
	fromNetwork: string;
	toNetwork: string;
};

export type TransferIntent = {
	intent: 'transfer';
	amount: string;
	fromToken: string;
	receiverAddress: string;
};

export type SwapIntent = {
	intent: 'swap';
	amount: string;
	fromToken: string;
	toToken: string;
	chain: string;
};
