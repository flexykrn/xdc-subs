import { createPublicClient, http, formatEther, type Abi } from "viem";
import { APOTHEM_CHAIN } from "@/config/chains";

const rpcUrl = process.env.NEXT_PUBLIC_APOTHEM_RPC_URL || "https://erpc.apothem.network";

const publicClient = createPublicClient({
  transport: http(rpcUrl),
});

const erc20Abi = [
  {
    name: "balanceOf",
    type: "function",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
  {
    name: "decimals",
    type: "function",
    inputs: [],
    outputs: [{ type: "uint8" }],
    stateMutability: "view",
  },
  {
    name: "symbol",
    type: "function",
    inputs: [],
    outputs: [{ type: "string" }],
    stateMutability: "view",
  },
] as const;

// Token info cache (symbol/decimals don't change)
const tokenInfoCache = new Map<string, { symbol: string; decimals: number }>();

export async function getTokenBalance(tokenAddress: string, walletAddress: string): Promise<string> {
  try {
    const balance = await publicClient.readContract({
      address: tokenAddress as `0x${string}`,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [walletAddress as `0x${string}`],
    });
    return formatEther(balance as bigint);
  } catch (err) {
    console.warn(`[Blockchain] Failed to read balance for ${tokenAddress}:`, err);
    return "0";
  }
}

export async function getTokenInfo(tokenAddress: string): Promise<{ symbol: string; decimals: number }> {
  const cacheKey = tokenAddress.toLowerCase();
  if (tokenInfoCache.has(cacheKey)) {
    return tokenInfoCache.get(cacheKey)!;
  }

  try {
    const [symbol, decimals] = await Promise.all([
      publicClient.readContract({
        address: tokenAddress as `0x${string}`,
        abi: erc20Abi,
        functionName: "symbol",
      }),
      publicClient.readContract({
        address: tokenAddress as `0x${string}`,
        abi: erc20Abi,
        functionName: "decimals",
      }),
    ]);
    const result = { symbol: symbol as string, decimals: decimals as number };
    tokenInfoCache.set(cacheKey, result);
    return result;
  } catch (err) {
    console.warn(`[Blockchain] Failed to read token info for ${tokenAddress}:`, err);
    const fallback = { symbol: "TOKEN", decimals: 18 };
    tokenInfoCache.set(cacheKey, fallback);
    return fallback;
  }
}

export async function getNativeBalance(walletAddress: string): Promise<string> {
  try {
    const balance = await publicClient.getBalance({
      address: walletAddress as `0x${string}`,
    });
    return formatEther(balance);
  } catch (err) {
    console.warn("[Blockchain] Failed to read native balance:", err);
    return "0";
  }
}

const subscriptionManagerAbi = [
  {
    name: "plans",
    type: "function",
    inputs: [{ name: "", type: "uint256" }],
    outputs: [
      { name: "price", type: "uint256" },
      { name: "interval", type: "uint256" },
      { name: "tokenAddress", type: "address" },
      { name: "active", type: "bool" },
    ],
    stateMutability: "view",
  },
  {
    name: "subscriptions",
    type: "function",
    inputs: [{ name: "", type: "uint256" }],
    outputs: [
      { name: "subscriber", type: "address" },
      { name: "planId", type: "uint256" },
      { name: "nextRenewalAt", type: "uint256" },
      { name: "active", type: "bool" },
      { name: "paused", type: "bool" },
    ],
    stateMutability: "view",
  },
  {
    name: "subscriptionCount",
    type: "function",
    inputs: [],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
  {
    name: "owner",
    type: "function",
    inputs: [],
    outputs: [{ type: "address" }],
    stateMutability: "view",
  },
] as const;

export interface OnChainPlan {
  planId: number;
  price: string;
  interval: number;
  tokenAddress: string;
  active: boolean;
}

export async function getPlan(contractAddress: string, planId: number): Promise<OnChainPlan | null> {
  try {
    const result = await publicClient.readContract({
      address: contractAddress as `0x${string}`,
      abi: subscriptionManagerAbi,
      functionName: "plans",
      args: [BigInt(planId)],
    });
    return {
      planId,
      price: formatEther(result[0]),
      interval: Number(result[1]),
      tokenAddress: result[2],
      active: result[3],
    };
  } catch (err) {
    console.warn(`[Blockchain] Failed to read plan ${planId}:`, err);
    return null;
  }
}

export interface OnChainSubscription {
  subscriptionId: number;
  planId: number;
  subscriber: string;
  nextRenewalAt: number;
  active: boolean;
  paused: boolean;
}

export async function getSubscription(contractAddress: string, subscriptionId: number): Promise<OnChainSubscription | null> {
  try {
    const result = await publicClient.readContract({
      address: contractAddress as `0x${string}`,
      abi: subscriptionManagerAbi,
      functionName: "subscriptions",
      args: [BigInt(subscriptionId)],
    });
    return {
      subscriptionId,
      subscriber: result[0],
      planId: Number(result[1]),
      nextRenewalAt: Number(result[2]),
      active: result[3],
      paused: result[4],
    };
  } catch (err) {
    console.warn(`[Blockchain] Failed to read subscription ${subscriptionId}:`, err);
    return null;
  }
}

export async function getSubscriptionCount(contractAddress: string): Promise<number> {
  try {
    const count = await publicClient.readContract({
      address: contractAddress as `0x${string}`,
      abi: subscriptionManagerAbi,
      functionName: "subscriptionCount",
    });
    return Number(count);
  } catch (err) {
    console.warn("[Blockchain] Failed to read subscription count:", err);
    return 0;
  }
}

export async function getOwner(contractAddress: string): Promise<string | null> {
  try {
    const owner = await publicClient.readContract({
      address: contractAddress as `0x${string}`,
      abi: subscriptionManagerAbi,
      functionName: "owner",
    });
    return owner as string;
  } catch (err) {
    console.warn("[Blockchain] Failed to read owner:", err);
    return null;
  }
}
