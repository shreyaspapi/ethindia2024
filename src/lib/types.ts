export type Intent = BridgeIntent | TransferIntent | SwapIntent | BalanceIntent;

export type BridgeIntent = {
	intent: 'bridge';
	amount: string;
	asset: string;
	fromNetwork: string;
	toNetwork: string;
};

export type TransferIntent = {
	intent: 'transfer';
	amount: string;
	asset: string;
	receiverAddress: string;
	chain: string;
};

export type SwapIntent = {
	intent: 'swap';
	amount: string;
	fromToken: string;
	toToken: string;
	chain: string;
};

export type BalanceIntent = {
	intent: 'balance';
	balance: string;
};
