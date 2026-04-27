import { Interface } from "ethers";

import { createPublicClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { APOTHEM_CHAIN } from "@/config/chains";
import { sendAATransaction, type Call, type SmartAccountInfo, getSmartAccountInfo } from "@/lib/aa-relay";
import { getBestTokenForPayment } from "@/lib/subscription-utils";
import { SERVICES } from "@/lib/services";

const rpcUrl = process.env.NEXT_PUBLIC_APOTHEM_RPC_URL || "https://erpc.apothem.network";

const publicClient = createPublicClient({
  transport: http(rpcUrl),
});

const erc20BalanceAbi = [{
  name: "balanceOf",
  type: "function",
  inputs: [{ name: "account", type: "address" }],
  outputs: [{ type: "uint256" }],
  stateMutability: "view",
}] as const;

export type SubscriptionAction = "createPlan" | "setTreasury" | "subscribe" | "renew" | "pause" | "cancel";

export interface BillingRecord {
  mode: "sponsor" | "erc20" | "multi-token";
  token?: string;
  subscriptionId?: string;
  uoHash?: string;
  txHash?: string;
  startedAt: string;
  confirmedAt?: string;
  result: "pending" | "success" | "failed";
}

export function buildEmptyBillingRecord(mode: BillingRecord["mode"]): BillingRecord {
  return {
    mode,
    startedAt: new Date().toISOString(),
    result: "pending",
  };
}

export interface SendSubscriptionActionParams {
  privateKey?: string;
  action: SubscriptionAction;
  mode: "sponsor" | "erc20" | "multi-token";
  subscriptionManagerAddress: string;
  tokenAddress?: string;
  planId?: number;
  subscriptionId?: number;
  tokenAmount?: string;
  approvalAmount?: string;
  planPrice?: string;
  planIntervalSeconds?: number;
  treasuryAddress?: string;
}

export interface SendSubscriptionActionResult extends BillingRecord {
  action: SubscriptionAction;
  smartAccountAddress: string;
  eoaAddress: string;
  nativeBalance: string;
}

const ERC20_APPROVE_ABI = ["function approve(address spender, uint256 amount)"];

const SUBSCRIPTION_MANAGER_ABI = [
  "function createPlan(uint256 planId, uint256 price, uint256 interval, address tokenAddress)",
  "function setTreasury(address newTreasury)",
  "function subscribe(uint256 planId)",
  "function renew(uint256 subscriptionId)",
  "function pause(uint256 subscriptionId)",
  "function cancel(uint256 subscriptionId)",
];

function getSubscriptionCallData(params: SendSubscriptionActionParams): { target: string; data: string } {
  const managerInterface = new Interface(SUBSCRIPTION_MANAGER_ABI);

  switch (params.action) {
    case "subscribe":
      return {
        target: params.subscriptionManagerAddress,
        data: managerInterface.encodeFunctionData("subscribe", [params.planId ?? 0]),
      };
    case "renew":
      return {
        target: params.subscriptionManagerAddress,
        data: managerInterface.encodeFunctionData("renew", [params.subscriptionId ?? 0]),
      };
    case "pause":
      return {
        target: params.subscriptionManagerAddress,
        data: managerInterface.encodeFunctionData("pause", [params.subscriptionId ?? 0]),
      };
    case "cancel":
      return {
        target: params.subscriptionManagerAddress,
        data: managerInterface.encodeFunctionData("cancel", [params.subscriptionId ?? 0]),
      };
    case "createPlan":
      return {
        target: params.subscriptionManagerAddress,
        data: managerInterface.encodeFunctionData("createPlan", [
          params.planId ?? 0,
          params.planPrice ?? params.tokenAmount ?? "0",
          params.planIntervalSeconds ?? 30 * 24 * 60 * 60,
          params.tokenAddress ?? "0x0000000000000000000000000000000000000000",
        ]),
      };
    case "setTreasury":
      return {
        target: params.subscriptionManagerAddress,
        data: managerInterface.encodeFunctionData("setTreasury", [
          params.treasuryAddress ?? "0x0000000000000000000000000000000000000000",
        ]),
      };
    default:
      throw new Error("Unsupported action");
  }
}

export async function sendSubscriptionAction(
  params: SendSubscriptionActionParams,
): Promise<SendSubscriptionActionResult> {
  const privateKey = params.privateKey || "";
  if (!privateKey) {
    throw new Error("Private key is required. Please connect your wallet first.");
  }

  const eoa = privateKeyToAccount(privateKey as `0x${string}`);

  // Get smart account info
  let smartAccountInfo: SmartAccountInfo;
  try {
    smartAccountInfo = await getSmartAccountInfo(privateKey);
  } catch (err) {
    console.warn("[Subscription] Failed to get smart account info:", err);
    throw new Error("Failed to initialize smart account. Please try again.");
  }

  // Multi-token: pick best token automatically
  let resolvedTokenAddress = params.tokenAddress;
  let resolvedTokenAmount = params.tokenAmount;

  if (params.mode === "multi-token" && params.action === "subscribe") {
    try {
      const best = await getBestTokenForPayment(eoa.address, params.tokenAmount || "0");
      if (best) {
        resolvedTokenAddress = best.tokenAddress;
        const service = SERVICES.find(s => s.tokenAddress === best.tokenAddress);
        if (service) {
          const tier = service.tiers.find(t => t.planId === params.planId);
          if (tier) {
            resolvedTokenAmount = tier.price;
          }
        }
      }
    } catch {
      // Fall through to default token
    }
  }

  // Build calls for AA batching
  const calls: Call[] = [];

  // For subscribe/renew with ERC20, add approval call first
  if (
    (params.action === "subscribe" || params.action === "renew") &&
    resolvedTokenAddress
  ) {
    const approvalAmount = params.approvalAmount ?? resolvedTokenAmount ?? "0";
    const erc20Interface = new Interface(ERC20_APPROVE_ABI);
    calls.push({
      to: resolvedTokenAddress as `0x${string}`,
      data: erc20Interface.encodeFunctionData("approve", [
        params.subscriptionManagerAddress,
        approvalAmount,
      ]) as `0x${string}`,
    });
  }

  // Add the main subscription action call
  const callData = getSubscriptionCallData(params);
  calls.push({
    to: callData.target as `0x${string}`,
    data: callData.data as `0x${string}`,
  });

  // Send via AA relay (gasless!)
  try {
    const result = await sendAATransaction({ privateKey, calls });

    return {
      action: params.action,
      mode: params.mode,
      token: resolvedTokenAddress,
      subscriptionId: params.subscriptionId?.toString(),
      uoHash: result.txHash, // Using txHash as uoHash for simplicity
      txHash: result.txHash,
      startedAt: new Date().toISOString(),
      confirmedAt: new Date().toISOString(),
      result: "success",
      smartAccountAddress: result.smartAccountAddress,
      eoaAddress: eoa.address,
      nativeBalance: "0", // User has no native balance in AA mode
    };
  } catch (aaError) {
    console.error("[Subscription] AA relay failed:", aaError);
    throw new Error(
      aaError instanceof Error
        ? `Gasless transaction failed: ${aaError.message}`
        : "Gasless transaction failed. Please try again."
    );
  }
}
