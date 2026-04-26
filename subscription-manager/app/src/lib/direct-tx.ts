import { APOTHEM_CHAIN } from "@/config/chains";
import { createWalletClient, createPublicClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const rpcUrl = process.env.NEXT_PUBLIC_APOTHEM_RPC_URL || "https://erpc.apothem.network";

const viemChain = {
  id: APOTHEM_CHAIN.chainIdDecimal,
  name: APOTHEM_CHAIN.chainName,
  nativeCurrency: APOTHEM_CHAIN.nativeCurrency,
  rpcUrls: {
    default: { http: [APOTHEM_CHAIN.rpcUrl] },
    public: { http: [APOTHEM_CHAIN.rpcUrl] },
  },
  blockExplorers: {
    default: { name: "Apothem Explorer", url: APOTHEM_CHAIN.explorerUrl },
  },
  testnet: true,
} as const;

const publicClient = createPublicClient({
  chain: viemChain,
  transport: http(rpcUrl),
});

const subscriptionManagerAbi = [
  {
    name: "subscribe",
    type: "function",
    inputs: [{ name: "planId", type: "uint256" }],
    outputs: [{ name: "subscriptionId", type: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    name: "renew",
    type: "function",
    inputs: [{ name: "subscriptionId", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    name: "pause",
    type: "function",
    inputs: [{ name: "subscriptionId", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    name: "cancel",
    type: "function",
    inputs: [{ name: "subscriptionId", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
] as const;

const erc20Abi = [
  {
    name: "approve",
    type: "function",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
    stateMutability: "nonpayable",
  },
  {
    name: "allowance",
    type: "function",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
] as const;

export interface DirectTxResult {
  txHash: string;
  subscriptionId?: string;
  explorerUrl: string;
}

export async function subscribeDirect(
  privateKey: string,
  subscriptionManagerAddress: string,
  planId: number,
  tokenAddress?: string,
  price?: string
): Promise<DirectTxResult> {
  const account = privateKeyToAccount(privateKey as `0x${string}`);
  const walletClient = createWalletClient({
    account,
    chain: viemChain,
    transport: http(rpcUrl),
  });

  // If ERC20 mode, approve first
  if (tokenAddress && price) {
    const allowance = await publicClient.readContract({
      address: tokenAddress as `0x${string}`,
      abi: erc20Abi,
      functionName: "allowance",
      args: [account.address, subscriptionManagerAddress as `0x${string}`],
    });

    if ((allowance as bigint) < BigInt(price)) {
      const approveHash = await walletClient.writeContract({
        address: tokenAddress as `0x${string}`,
        abi: erc20Abi,
        functionName: "approve",
        args: [subscriptionManagerAddress as `0x${string}`, BigInt(price) * BigInt(10)], // approve 10x to avoid re-approve
      });
      console.log("[DirectTx] Approval tx:", approveHash);
      
      // Actually wait for approval to be mined
      let receipt = null;
      for (let i = 0; i < 30; i++) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        try {
          receipt = await publicClient.getTransactionReceipt({ hash: approveHash });
          if (receipt && receipt.status === 'success') {
            console.log("[DirectTx] Approval confirmed");
            break;
          }
        } catch {
          // Receipt not available yet, retry
        }
      }
      
      if (!receipt || receipt.status !== 'success') {
        throw new Error("Token approval failed or timed out. Please try again.");
      }
      
      // Small buffer after confirmation
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  // Call subscribe
  const txHash = await walletClient.writeContract({
    address: subscriptionManagerAddress as `0x${string}`,
    abi: subscriptionManagerAbi,
    functionName: "subscribe",
    args: [BigInt(planId)],
  });

  const explorerUrl = `${process.env.NEXT_PUBLIC_EXPLORER_URL || "https://explorer.apothem.network/"}tx/${txHash}`;

  return {
    txHash,
    explorerUrl,
  };
}

export async function renewDirect(
  privateKey: string,
  subscriptionManagerAddress: string,
  subscriptionId: number
): Promise<DirectTxResult> {
  const account = privateKeyToAccount(privateKey as `0x${string}`);
  const walletClient = createWalletClient({
    account,
    chain: viemChain,
    transport: http(rpcUrl),
  });

  const txHash = await walletClient.writeContract({
    address: subscriptionManagerAddress as `0x${string}`,
    abi: subscriptionManagerAbi,
    functionName: "renew",
    args: [BigInt(subscriptionId)],
  });

  const explorerUrl = `${process.env.NEXT_PUBLIC_EXPLORER_URL || "https://explorer.apothem.network/"}tx/${txHash}`;

  return { txHash, explorerUrl };
}

export async function pauseDirect(
  privateKey: string,
  subscriptionManagerAddress: string,
  subscriptionId: number
): Promise<DirectTxResult> {
  const account = privateKeyToAccount(privateKey as `0x${string}`);
  const walletClient = createWalletClient({
    account,
    chain: viemChain,
    transport: http(rpcUrl),
  });

  const txHash = await walletClient.writeContract({
    address: subscriptionManagerAddress as `0x${string}`,
    abi: subscriptionManagerAbi,
    functionName: "pause",
    args: [BigInt(subscriptionId)],
  });

  const explorerUrl = `${process.env.NEXT_PUBLIC_EXPLORER_URL || "https://explorer.apothem.network/"}tx/${txHash}`;

  return { txHash, explorerUrl };
}

export async function cancelDirect(
  privateKey: string,
  subscriptionManagerAddress: string,
  subscriptionId: number
): Promise<DirectTxResult> {
  const account = privateKeyToAccount(privateKey as `0x${string}`);
  const walletClient = createWalletClient({
    account,
    chain: viemChain,
    transport: http(rpcUrl),
  });

  const txHash = await walletClient.writeContract({
    address: subscriptionManagerAddress as `0x${string}`,
    abi: subscriptionManagerAbi,
    functionName: "cancel",
    args: [BigInt(subscriptionId)],
  });

  const explorerUrl = `${process.env.NEXT_PUBLIC_EXPLORER_URL || "https://explorer.apothem.network/"}tx/${txHash}`;

  return { txHash, explorerUrl };
}
