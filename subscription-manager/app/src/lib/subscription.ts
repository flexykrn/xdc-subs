import { createPublicClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { getBestTokenForPayment } from "@/lib/subscription-utils";
import { SERVICES } from "@/lib/services";
import { getEtherspotPrime } from "./etherspot";
import { executeAASubscription, executeAALifecycle, type GasMode } from "./aa-subscription";

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
  mode: GasMode;
  subscriptionManagerAddress: string;
  tokenAddress?: string;
  planId?: number;
  subscriptionId?: number;
  tokenAmount?: string;
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

export async function sendSubscriptionAction(
  params: SendSubscriptionActionParams,
): Promise<SendSubscriptionActionResult> {
  const privateKey = params.privateKey || "";
  if (!privateKey) {
    throw new Error("Private key is required. Please connect your wallet first.");
  }

  const eoa = privateKeyToAccount(privateKey as `0x${string}`);

  // Resolve token for multi-token mode
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
    } catch (err) {
      console.warn("[Subscription] Multi-token resolution failed:", err);
    }
  }

  // Create a mock EIP1193 provider from private key for EtherspotPrime
  const provider = {
    request: async ({ method, params }: any) => {
      if (method === "eth_accounts" || method === "eth_requestAccounts") {
        return [eoa.address];
      }
      if (method === "eth_sign") {
        // Not used - Etherspot handles signing internally
        return "0x";
      }
      throw new Error(`Method ${method} not supported by mock provider`);
    },
  };

  const primeSdk = await getEtherspotPrime(provider);
  const smartAccountAddress = await primeSdk.getCounterFactualAddress();
  const nativeBalance = await publicClient.getBalance({ address: eoa.address });

  console.log("[Subscription] EOA:", eoa.address);
  console.log("[Subscription] Smart Account:", smartAccountAddress);

  let result: { userOpHash: string; txHash: string };

  switch (params.action) {
    case "subscribe": {
      result = await executeAASubscription(
        primeSdk,
        params.subscriptionManagerAddress,
        params.planId ?? 0,
        params.mode,
        resolvedTokenAddress,
        resolvedTokenAmount,
      );
      break;
    }

    case "renew":
    case "pause":
    case "cancel": {
      result = await executeAALifecycle(
        primeSdk,
        params.subscriptionManagerAddress,
        params.subscriptionId ?? 0,
        params.action,
      );
      break;
    }

    case "createPlan":
    case "setTreasury": {
      throw new Error(`Action "${params.action}" must be sent via direct EOA.`);
    }

    default:
      throw new Error(`Unsupported action: ${params.action}`);
  }

  console.log("[Subscription] UserOp sent:", result.userOpHash);
  console.log("[Subscription] Tx:", result.txHash);

  return {
    action: params.action,
    mode: params.mode,
    token: resolvedTokenAddress,
    subscriptionId: params.subscriptionId?.toString(),
    uoHash: result.userOpHash,
    txHash: result.txHash,
    startedAt: new Date().toISOString(),
    confirmedAt: new Date().toISOString(),
    result: "success",
    smartAccountAddress,
    eoaAddress: eoa.address,
    nativeBalance: nativeBalance.toString(),
  };
}
