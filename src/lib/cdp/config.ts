'use server';

import { CdpAgentkit } from '@coinbase/cdp-agentkit-core';
import { CdpTool, CdpToolkit } from '@coinbase/cdp-langchain';
import { ChatOpenAI, AzureChatOpenAI } from '@langchain/openai';
import { initializeAgentExecutorWithOptions } from 'langchain/agents';
import { createPublicClient, decodeAbiParameters, http, keccak256, toBytes } from 'viem';
import { base } from 'viem/chains';
import { z } from 'zod';
import { Wallet } from '@coinbase/coinbase-sdk';
import { hashMessage } from '@coinbase/coinbase-sdk';

// CCTP and USDC contract addresses
const BASE_TOKEN_MESSENGER_ADDRESS = "0x1682Ae6375C4E4A97e4B583BC394c861A46D8962";
const ARBITRUM_MESSAGE_TRANSMITTER_ADDRESS = "0xC30362313FBBA5cf9163F0bb16a0e01f01A896ca";
const USDC_BASE_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

// ABI definitions
const tokenMessengerAbi = [
  {
    inputs: [
      { internalType: "uint256", name: "amount", type: "uint256" },
      { internalType: "uint32", name: "destinationDomain", type: "uint32" },
      { internalType: "bytes32", name: "mintRecipient", type: "bytes32" },
      { internalType: "address", name: "burnToken", type: "address" },
    ],
    name: "depositForBurn",
    outputs: [
      { internalType: "uint64", name: "_nonce", type: "uint64" },
    ],
    stateMutability: "nonpayable",
    type: "function",
  },
];

const messageTransmitterAbi = [
  {
    inputs: [
      { internalType: "bytes", name: "message", type: "bytes" },
      { internalType: "bytes", name: "attestation", type: "bytes" },
    ],
    name: "receiveMessage",
    outputs: [
      { internalType: "bool", name: "success", type: "bool" },
    ],
    stateMutability: "nonpayable",
    type: "function",
  },
];

let executorMessage: any;

// Helper Functions
function padAddress(address: string): string {
    address = address.replace(/^0x/, '');
    return '0x' + address.padStart(64, '0');
}

async function getTransactionReceipt(txHash: string) {
    const publicClient = createPublicClient({
        chain: base,
        transport: http(),
    });
    return await publicClient.getTransactionReceipt({ hash: txHash });
}

// Bridging Function
async function bridgeUSDC(baseWallet: Wallet, arbitrumWallet: Wallet, usdcAmount: number) {
    const baseUSDCBalance = await baseWallet.getBalance("usdc");
    const arbitrumUSDCBalance = await arbitrumWallet.getBalance("usdc");
    console.log("Base USDC initial balance:", baseUSDCBalance, "| Arbitrum USDC initial balance:", arbitrumUSDCBalance);

    const arbitrumRecipientAddress = padAddress((await arbitrumWallet.getDefaultAddress()).getId());
    
    // Step 1: Approve TokenMessenger
    const approveTx = await baseWallet.invokeContract({
        contractAddress: USDC_BASE_ADDRESS,
        method: "approve",
        args: {
            spender: BASE_TOKEN_MESSENGER_ADDRESS,
            value: usdcAmount.toString()
        },
    });
    await approveTx.wait();
    console.log("Approve transaction completed:", approveTx.getTransactionHash());
    
    // Step 2: Deposit for burn
    const depositTx = await baseWallet.invokeContract({
        contractAddress: BASE_TOKEN_MESSENGER_ADDRESS,
        method: "depositForBurn",
        args: {
            amount: usdcAmount.toString(),
            destinationDomain: "3",
            mintRecipient: arbitrumRecipientAddress,
            burnToken: USDC_BASE_ADDRESS
        },
        abi: tokenMessengerAbi
    });
    await depositTx.wait();
    console.log("Deposit transaction completed:", depositTx.getTransactionHash());
    
    // Step 3: Get messageHash
    const transactionReceipt = await getTransactionReceipt(depositTx.getTransactionHash());
    const eventTopic = keccak256(toBytes('MessageSent(bytes)'));
    const log = transactionReceipt.logs.find((l) => l.topics[0] === eventTopic);
    if (!log) {
        throw new Error('MessageSent event not found in transaction logs');
    }
    const messageBytes = decodeAbiParameters([{ type: 'bytes' }], log.data)[0];
    const messageHash = keccak256(messageBytes)
    console.log("Message hash:", messageHash);

    // Step 4: Wait for attestation
    let attestationResponse = { status: 'pending' }
    while (attestationResponse.status != 'complete') {
        const response = await fetch(
            `https://iris-api.circle.com/attestations/${messageHash}`,
        )
        attestationResponse = await response.json()
        await new Promise((r) => setTimeout(r, 2000))
    }

    const attestationSignature = attestationResponse.attestation;
    console.log("Received attestation signature:", attestationSignature);

    // Step 5: Receive message on Arbitrum
    const receiveMessageTx = await arbitrumWallet.invokeContract({
        contractAddress: ARBITRUM_MESSAGE_TRANSMITTER_ADDRESS,
        method: "receiveMessage",
        args: {
            message: messageBytes,
            attestation: attestationSignature
        },
        abi: messageTransmitterAbi
    });
    await receiveMessageTx.wait();
    console.log("Receive message transaction completed:", receiveMessageTx.getTransactionHash());

    const finalBaseUSDCBalance = await baseWallet.getBalance("usdc");
    const finalArbitrumUSDCBalance = await arbitrumWallet.getBalance("usdc");
    console.log("Base USDC final balance:", finalBaseUSDCBalance, "| Arbitrum USDC final balance:", finalArbitrumUSDCBalance);
}

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

async function signMessage(
    wallet: Wallet,
    args: z.infer<typeof SignMessageInput>
): Promise<string> {
    const payloadSignature = await wallet.createPayloadSignature(hashMessage(args.message));
    return `The payload signature ${payloadSignature}`;
}

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

// Create toolkit and get tools
const toolkit = new CdpToolkit(agentkit);
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

// Add the bridge USDC tool
const BridgeUSDCInput = z.object({
    usdcAmount: z.number().describe('Amount of USDC to bridge from Base to Arbitrum')
});

const bridgeUsdcTool = new CdpTool(
    {
        name: 'bridge_usdc',
        description: 'Bridge USDC tokens from Base to Arbitrum using Circle\'s Cross-Chain Transfer Protocol (CCTP)',
        argsSchema: BridgeUSDCInput,
        func: async (wallet: Wallet, args: z.infer<typeof BridgeUSDCInput>) => {
            // For this example, we're using the same wallet for both chains
            // In a production environment, you might want to handle this differently
            return bridgeUSDC(wallet, wallet, args.usdcAmount);
        }
    },
    agentkit
);
tools.push(bridgeUsdcTool);

// Add approve message prompt and input schema
const APPROVE_PROMPT = `
This tool will create and sign an ERC20 approve transaction allowing a spender to transfer tokens on behalf of the owner.
`;

const ApproveInput = z
    .object({
        spender: z.string().describe("The address being approved to spend tokens"),
        value: z.string().describe("The amount of tokens to approve (in wei)"),
        tokenAddress: z.string().describe("The ERC20 token contract address"),
    })
    .strip()
    .describe("Parameters for ERC20 approve function");

const erc20Abi = [
    {
        inputs: [
            { internalType: "address", name: "spender", type: "address" },
            { internalType: "uint256", name: "value", type: "uint256" }
        ],
        name: "approve",
        outputs: [{ internalType: "bool", name: "", type: "bool" }],
        stateMutability: "nonpayable",
        type: "function"
    }
];

// Add swap prompt and input schema
const SWAP_PROMPT = `
This tool is used to swap hit token with WETH token.`;

const SwapInput = z
    .object({
        amountA: z.string().describe("The amount of tokenA to swap (in wei)"),
    })
    .strip()
    .describe("Parameters for swap function");

const swapAbi = [
    {
        inputs: [
            { internalType: "uint256", name: "amountA", type: "uint256" }
        ],
        name: "swap",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function"
    }
];

// Add approve function
async function approve(
    wallet: Wallet,
    args: z.infer<typeof ApproveInput>
): Promise<string> {
    try {
        const signedTx = await wallet.invokeContract({
            contractAddress: args.tokenAddress,
            abi: erc20Abi,
            method: "approve",
            args: {
                spender: args.spender,
                value: args.value
            }
        });
        return `Approve transaction signed: ${signedTx}`;
    } catch (e) {
        console.error(e);
        throw e;
    }
}

// Add swap function
async function swap(
    wallet: Wallet,
    args: z.infer<typeof SwapInput>
): Promise<string> {
    try {
        const signedTx = await wallet.invokeContract({
            contractAddress: "0x4257503d8b6Fe15B1d72d3FF536309f4eDF291DE",
            abi: swapAbi,
            method: "swap",
            args: {
                amountA: args.amountA
            }
        });
        const txnId = await signedTx?.wait();
        return `Swap transaction ID: ${txnId}`;
    } catch (e) {
        console.error(e);
        throw e;
    }
}

// Add the approve tool
const approveTool = new CdpTool(
    {
        name: "approve_tokens",
        description: APPROVE_PROMPT,
        argsSchema: ApproveInput,
        func: approve,
    },
    agentkit
);

// Add the swap tool
const swapTool = new CdpTool(
    {
        name: "swap_tokens",
        description: SWAP_PROMPT,
        argsSchema: SwapInput,
        func: swap,
    },
    agentkit
);

// Add tools to the tools array
tools.push(approveTool);
tools.push(swapTool);

// Initialize LLM
const model = new ChatOpenAI({
    model: 'gpt-4o',
    apiKey: process.env.OPENAI_API_KEY
});

export async function invokeModel(input: string) {
    const result = await model.invoke(input);
    console.log('result from invokeModel', result);
    return {
        output: result.content
    };
}

// Create agent executor
const executor = await initializeAgentExecutorWithOptions(tools, model, {
    agentType: 'structured-chat-zero-shot-react-description'
});

export async function invokeExecutor(input: string) {
    const result = await executor.invoke({ input });
    console.log('result from invokeExecutor', result);
    return {
        output: result.output
    };
}
