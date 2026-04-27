import { Interface } from "ethers";

import { createPublicClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { subscribeDirect, renewDirect, pauseDirect, cancelDirect } from "@/lib/direct-tx";
import { getBestTokenForPayment } from "@/lib/subscription-utils";
import { SERVICES } from "@/lib/services";
import { subscribeAA } from "./aa-client";

const rpcUrl = process.env.NEXT_PUBLIC_APOTHEM_RPC_URL || "https://erpc.apothem.network";

const publicClient = createPublicClient({
  transport: http(rpcUrl),
});

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
  bundlerUrl?: string;
  arkaApiKey?: string;
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

  // ── Account Abstraction Flow ──
  // Sponsor mode: Real ERC-4337 UserOp through EntryPoint + Paymaster
  // ERC20 mode: EOA fallback with TokenGasPaymaster swap for gas
  console.log("[Subscription] Mode:", params.mode);

  let fallback;
  switch (params.action) {
    case "subscribe":
      if (params.mode === "sponsor" || params.mode === "multi-token") {
        // Real AA: UserOp via EntryPoint + Paymaster
        console.log("[Subscription] Using AA UserOp flow");
        const eoaAddress = privateKeyToAccount(privateKey as `0x${string}`).address;
        fallback = await subscribeAA(
          privateKey,
          eoaAddress,
          params.subscriptionManagerAddress,
          params.planId ?? 0,
          resolvedTokenAddress,
          resolvedTokenAmount,
        );
        // Map AA result to DirectTxResult shape
        fallback = {
          txHash: fallback.txHash,
          explorerUrl: fallback.explorerUrl,
        };
      } else {
        // ERC20 mode: EOA with paymaster swap
        console.log("[Subscription] Using ERC20 EOA fallback");
        fallback = await subscribeDirect(
          privateKey,
          params.subscriptionManagerAddress,
          params.planId ?? 0,
          resolvedTokenAddress,
          resolvedTokenAmount,
          "erc20",
        );
      }
      break;
    case "renew":
      fallback = await renewDirect(
        privateKey,
        params.subscriptionManagerAddress,
        params.subscriptionId ?? 0,
      );
      break;
    case "pause":
      fallback = await pauseDirect(
        privateKey,
        params.subscriptionManagerAddress,
        params.subscriptionId ?? 0,
      );
      break;
    case "cancel":
      fallback = await cancelDirect(
        privateKey,
        params.subscriptionManagerAddress,
        params.subscriptionId ?? 0,
      );
      break;
    default:
      throw new Error(`Action ${params.action} not supported`);
  }

  return {
    action: params.action,
    mode: params.mode,
    token: resolvedTokenAddress,
    subscriptionId: params.subscriptionId?.toString(),
    uoHash: "eoa-fallback",
    txHash: fallback.txHash,
    startedAt: new Date().toISOString(),
    confirmedAt: new Date().toISOString(),
    result: "success",
    smartAccountAddress: eoa.address, // On testnet, EOA is the active account
    eoaAddress: eoa.address,
    nativeBalance: "0",
  };
}
