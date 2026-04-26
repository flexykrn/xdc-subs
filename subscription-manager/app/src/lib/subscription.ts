import { Interface } from "ethers";

import { createPublicClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { APOTHEM_CHAIN } from "@/config/chains";
import { subscribeDirect, renewDirect, pauseDirect, cancelDirect } from "@/lib/direct-tx";
import { createModularSdk, type SmartAccountSnapshot } from "@/lib/etherspot";
import { buildPaymasterContext, getPaymasterUrl, type GasMode } from "@/lib/etherspot";
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
  mode: GasMode;
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

export interface SendSubscriptionActionResult extends BillingRecord, SmartAccountSnapshot {
  action: SubscriptionAction;
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

function getRequiredEnvValue(value: string | undefined, label: string): string {
  if (!value) {
    throw new Error(`Missing ${label}`);
  }

  return value;
}

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

  // Multi-token: pick best token automatically
  let resolvedTokenAddress = params.tokenAddress;
  let resolvedTokenAmount = params.tokenAmount;
  
  if (params.mode === "multi-token" && params.action === "subscribe") {
    try {
      const eoaAccount = privateKeyToAccount(privateKey as `0x${string}`);
      const best = await getBestTokenForPayment(eoaAccount.address, params.tokenAmount || "0");
      if (best) {
        resolvedTokenAddress = best.tokenAddress;
        // Find the plan price for this token's service
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

  // Try Etherspot AA first
  try {
    const sdk = createModularSdk(privateKey, params.bundlerUrl);
    const smartAccountAddress = await sdk.getCounterFactualAddress();
    const nativeBalance = await sdk.getNativeBalance();

    await sdk.clearUserOpsFromBatch();

    if ((params.action === "subscribe" || params.action === "renew") && resolvedTokenAddress) {
      const approvalAmount = params.approvalAmount ?? resolvedTokenAmount ?? "0";
      const erc20Interface = new Interface(ERC20_APPROVE_ABI);

      await sdk.addUserOpsToBatch({
        to: resolvedTokenAddress,
        data: erc20Interface.encodeFunctionData("approve", [params.subscriptionManagerAddress, approvalAmount]),
      });
    }

    const callData = getSubscriptionCallData(params);

    await sdk.addUserOpsToBatch({
      to: callData.target,
      data: callData.data,
    });

    const paymasterDetails = {
      url: getPaymasterUrl(getRequiredEnvValue(params.arkaApiKey, "NEXT_PUBLIC_ARKA_API_KEY")),
      context: buildPaymasterContext(params.mode, resolvedTokenAddress),
    };

    const estimatedUserOp = await sdk.estimate({
      paymasterDetails,
    });

    const userOpHash = await sdk.send(estimatedUserOp);
    
    // Poll for receipt (up to 60 seconds)
    let txHash = "";
    for (let i = 0; i < 20; i++) {
      await new Promise((resolve) => setTimeout(resolve, 3000));
      try {
        txHash = await sdk.getUserOpReceipt(userOpHash);
        if (txHash) break;
      } catch {
        // Receipt not ready yet, continue polling
      }
    }

    await sdk.clearUserOpsFromBatch();

    return {
      action: params.action,
      mode: params.mode,
      token: resolvedTokenAddress,
      subscriptionId: params.subscriptionId?.toString(),
      uoHash: userOpHash,
      txHash,
      startedAt: new Date().toISOString(),
      confirmedAt: new Date().toISOString(),
      result: txHash ? "success" : "failed",
      smartAccountAddress,
      nativeBalance,
      eoaAddress: "",
    };
  } catch (etherspotError) {
    console.warn("[Subscription] Etherspot failed, falling back to direct EOA:", etherspotError);

    // Fallback to direct EOA transaction
    let result;
    switch (params.action) {
      case "subscribe":
        result = await subscribeDirect(
          privateKey,
          params.subscriptionManagerAddress,
          params.planId ?? 0,
          resolvedTokenAddress,
          resolvedTokenAmount
        );
        break;
      case "renew":
        result = await renewDirect(
          privateKey,
          params.subscriptionManagerAddress,
          params.subscriptionId ?? 0
        );
        break;
      case "pause":
        result = await pauseDirect(
          privateKey,
          params.subscriptionManagerAddress,
          params.subscriptionId ?? 0
        );
        break;
      case "cancel":
        result = await cancelDirect(
          privateKey,
          params.subscriptionManagerAddress,
          params.subscriptionId ?? 0
        );
        break;
      default:
        throw new Error(`Action ${params.action} not supported in fallback mode`);
    }

    return {
      action: params.action,
      mode: params.mode,
      token: resolvedTokenAddress,
      subscriptionId: params.subscriptionId?.toString(),
      uoHash: "fallback-eoa",
      txHash: result.txHash,
      startedAt: new Date().toISOString(),
      confirmedAt: new Date().toISOString(),
      result: "success",
      smartAccountAddress: result.explorerUrl.includes("tx/") ? "EOA fallback (see tx)" : "EOA fallback active",
      nativeBalance: "0",
      eoaAddress: "",
    };
  }
}
