'use server';

import { CdpAgentkit } from '@coinbase/cdp-agentkit-core';
import { CdpTool, CdpToolkit } from '@coinbase/cdp-langchain';
import { ChatOpenAI, AzureChatOpenAI } from '@langchain/openai';
import { initializeAgentExecutorWithOptions } from 'langchain/agents';

import { z } from 'zod';

import { Wallet } from '@coinbase/coinbase-sdk';

import { hashMessage } from '@coinbase/coinbase-sdk';

// let walletDataStr: string | null = null;

// Sign Message Stuff
const SIGN_MESSAGE_PROMPT = `
This tool will sign arbitrary messages using EIP-191 Signed Message Standard hashing.
`;

const SignMessageInput = z
	.object({
		message: z.string().describe('The message to sign. e.g. `hello world`')
	})
	.strip()
	.describe('Instructions for signing a blockchain message');

/**
 * Signs a message using EIP-191 message hash from the wallet
 *
 * @param wallet - The wallet to sign the message from
 * @param args - The input arguments for the action
 * @returns The message and corresponding signature
 */
async function signMessage(
	wallet: Wallet,
	args: z.infer<typeof SignMessageInput>
): Promise<string> {
	// Using the correct method from Wallet interface
	const payloadSignature = await wallet.createPayloadSignature(hashMessage(args.message));
	return `The payload signature ${payloadSignature}`;
}

// Configure a file to persist the agent's CDP MPC Wallet Data
// const WALLET_DATA_FILE = 'wallet.txt';
// Read existing wallet data if available
// if (fs.existsSync(WALLET_DATA_FILE)) {
// 	try {
// 		walletDataStr = fs.readFileSync(WALLET_DATA_FILE, 'utf8');
// 		console.log(walletDataStr);
// 	} catch (error) {
// 		console.error('Error reading wallet data:', error);
// 		// Continue without wallet data
// 	}
// }

const walletDataStr = JSON.stringify({
	walletId: '5081af65-3e07-4e6d-aa26-f3606deacedc',
	seed: '02d982038f9ab7ba981acc49805ea3009a0ee031783415b05775bc3e0eb579fe',
	defaultAddressId: '0xE23Adde6795DF1b2c6d093EBAFBAb11F142F12d4'
});

const config = {
	cdpWalletData: walletDataStr || undefined,
	networkId: process.env.NETWORK_ID || 'base-sepolia'
};

// Initialize CDP Agentkit
const agentkit = await CdpAgentkit.configureWithWallet(config);

agentkit.exportWallet().then((response) => {
	console.log(response);
});
// Create toolkit
const toolkit = new CdpToolkit(agentkit);

// Get available tools
const tools = toolkit.getTools();

// Add the sign message tool
const signMessageTool = new CdpTool(
	{
		name: 'sign_message',
		description: SIGN_MESSAGE_PROMPT,
		argsSchema: SignMessageInput,
		func: signMessage
	},
	agentkit
);
tools.push(signMessageTool);

console.log(tools);

// Initialize LLM
const model = new ChatOpenAI({
	model: 'gpt-4o',
	apiKey: process.env.OPENAI_API_KEY
});

// Create agent executor
const executor = await initializeAgentExecutorWithOptions(tools, model, {
	// agentType: "chat-conversational-react-description",
	agentType: 'structured-chat-zero-shot-react-description',
	verbose: true
});

console.log('executor from config', executor);

// const result = await executor.invoke({
// 	input: 'tell me a joke and sign it too'
// });

export async function invokeExecutor(input: string) {
	const result = await executor.invoke({ input });
	console.log('result from invokeExecutor', result);
}
