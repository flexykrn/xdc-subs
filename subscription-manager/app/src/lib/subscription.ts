import { Interface } from "ethers";

import { createPublicClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { subscribeDirect, renewDirect, pauseDirect, cancelDirect } from "@/lib/direct-tx";
import { getBestTokenForPayment } from "@/lib/subscription-utils";
import { SERVICES } from "@/lib/services";

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

  // ── EOA Fallback with Deployer-Sponsored Gas ──
  // On XDC Apothem testnet, the Etherspot AA SDK has infrastructure gaps:
  // 1. Factory ABI mismatch between Etherspot's code and our deployed SimpleAccountFactory
  // 2. Bundler returns 400 for eth_chainId (network not fully supported)
  // 3. Paymaster sponsorship works but requires ERC-4337 infra that's unstable on testnet
  //
  // For reliable UX during the demo, we use EOA fallback with auto-funded gas:
  // - User has 0 tXDC → /api/gas-station sends 0.01 tXDC from deployer
  // - User pays only service tokens (ERC20) for the subscription itself
  // - Gas is "sponsored" by the deployer (simulating paymaster behavior)
  //
  // On mainnet, this would be replaced by true AA + Arka Paymaster (gasless).
  console.log("[Subscription] Using EOA fallback with deployer-sponsored gas");

  let fallback;
  switch (params.action) {
    case "subscribe":
      fallback = await subscribeDirect(
        privateKey,
        params.subscriptionManagerAddress,
        params.planId ?? 0,
        resolvedTokenAddress,
        resolvedTokenAmount,
        params.mode === "multi-token" ? "sponsor" : params.mode,
      );
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
