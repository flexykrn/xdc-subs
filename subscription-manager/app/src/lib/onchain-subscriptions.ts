import { JsonRpcProvider, Contract } from "ethers";

import { buildDemoAddress } from "@/lib/demo";
import { loadDeploymentRecord } from "@/lib/deployment";

const SUBSCRIPTION_MANAGER_ABI = [
  "function subscriptionCount() view returns (uint256)",
  "function subscriptions(uint256) view returns (address subscriber, uint256 planId, uint256 nextRenewalAt, bool active, bool paused)",
  "function plans(uint256) view returns (uint256 price, uint256 interval, address tokenAddress, bool active)",
];

export interface OnchainSubscriptionRow {
  subscriptionId: number;
  subscriber: string;
  planId: number;
  nextRenewalAtEpoch: number;
  nextRenewalAtIso: string;
  active: boolean;
  paused: boolean;
  due: boolean;
  planPriceWei: string;
  planIntervalSeconds: number;
  planTokenAddress: string;
}

export interface OnchainSubscriptionSnapshot {
  managerAddress: string;
  chainId: number;
  totalScanned: number;
  activeCount: number;
  pausedCount: number;
  dueCount: number;
  rows: OnchainSubscriptionRow[];
  generatedAt: string;
}

function toEpochSeconds(value: bigint): number {
  return Number(value);
}

export async function fetchOnchainSubscriptionSnapshot(): Promise<OnchainSubscriptionSnapshot> {
  const deployment = await loadDeploymentRecord();
  const managerAddress = deployment?.subscriptionManager || process.env.NEXT_PUBLIC_SUBSCRIPTION_MANAGER_ADDRESS || "";

  if (!managerAddress) {
    throw new Error("Missing subscription manager address in deployment.json or NEXT_PUBLIC_SUBSCRIPTION_MANAGER_ADDRESS");
  }

  const rpcUrl = process.env.NEXT_PUBLIC_APOTHEM_RPC_URL || "https://erpc.apothem.network";
  const provider = new JsonRpcProvider(rpcUrl);
  const manager = new Contract(managerAddress, SUBSCRIPTION_MANAGER_ABI, provider);

  const subscriptionCount = Number(await manager.subscriptionCount());
  const scanLimit = Number(process.env.SUBSCRIPTION_SCAN_LIMIT || 200);
  const upperBound = Math.min(subscriptionCount, scanLimit);
  const nowSeconds = Math.floor(Date.now() / 1000);

  // Fetch all subscriptions in parallel
  const subscriptionPromises = [];
  for (let subscriptionId = 1; subscriptionId <= upperBound; subscriptionId++) {
    subscriptionPromises.push(
      manager.subscriptions(subscriptionId).then((sub: any) => ({
        subscriptionId,
        subscriber: String(sub.subscriber),
        planId: Number(sub.planId),
        nextRenewalAtEpoch: toEpochSeconds(sub.nextRenewalAt),
        active: Boolean(sub.active),
        paused: Boolean(sub.paused),
      }))
    );
  }

  const rawSubs = await Promise.all(subscriptionPromises);

  // Fetch all plans in parallel (deduplicated)
  const uniquePlanIds = [...new Set(rawSubs.map(s => s.planId))];
  const planPromises = uniquePlanIds.map(async (planId) => {
    try {
      const plan = await manager.plans(planId);
      return {
        planId,
        planPriceWei: plan.price.toString(),
        planIntervalSeconds: Number(plan.interval),
        planTokenAddress: String(plan.tokenAddress),
      };
    } catch {
      return { planId, planPriceWei: "0", planIntervalSeconds: 0, planTokenAddress: "0x0000000000000000000000000000000000000000" };
    }
  });

  const planMap = new Map(
    (await Promise.all(planPromises)).map(p => [p.planId, p])
  );

  // Build final rows
  const rows: OnchainSubscriptionRow[] = rawSubs.map(sub => {
    const plan = planMap.get(sub.planId);
    const nextRenewalAtEpoch = sub.nextRenewalAtEpoch;
    const due = sub.active && !sub.paused && nextRenewalAtEpoch <= nowSeconds;

    return {
      subscriptionId: sub.subscriptionId,
      subscriber: sub.subscriber,
      planId: sub.planId,
      nextRenewalAtEpoch,
      nextRenewalAtIso: new Date(nextRenewalAtEpoch * 1000).toISOString(),
      active: sub.active,
      paused: sub.paused,
      due,
      planPriceWei: plan?.planPriceWei || "0",
      planIntervalSeconds: plan?.planIntervalSeconds || 0,
      planTokenAddress: plan?.planTokenAddress || "0x0000000000000000000000000000000000000000",
    };
  });

  return {
    managerAddress,
    chainId: deployment?.chainId || 51,
    totalScanned: rows.length,
    activeCount: rows.filter((item) => item.active).length,
    pausedCount: rows.filter((item) => item.paused).length,
    dueCount: rows.filter((item) => item.due).length,
    rows,
    generatedAt: new Date().toISOString(),
  };
}

// Demo data for evidence/summary API
export function buildDemoOnchainSubscriptionSnapshot(): OnchainSubscriptionSnapshot {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const rows: OnchainSubscriptionRow[] = [
    {
      subscriptionId: 1,
      subscriber: buildDemoAddress("1001"),
      planId: 1,
      nextRenewalAtEpoch: nowSeconds + 86400,
      nextRenewalAtIso: new Date((nowSeconds + 86400) * 1000).toISOString(),
      active: true,
      paused: false,
      due: false,
      planPriceWei: "10000000000000000000",
      planIntervalSeconds: 2592000,
      planTokenAddress: buildDemoAddress("aaaa"),
    },
    {
      subscriptionId: 2,
      subscriber: buildDemoAddress("2002"),
      planId: 2,
      nextRenewalAtEpoch: nowSeconds - 3600,
      nextRenewalAtIso: new Date((nowSeconds - 3600) * 1000).toISOString(),
      active: true,
      paused: false,
      due: true,
      planPriceWei: "25000000000000000000",
      planIntervalSeconds: 2592000,
      planTokenAddress: buildDemoAddress("bbbb"),
    },
    {
      subscriptionId: 3,
      subscriber: buildDemoAddress("3003"),
      planId: 3,
      nextRenewalAtEpoch: nowSeconds + 604800,
      nextRenewalAtIso: new Date((nowSeconds + 604800) * 1000).toISOString(),
      active: false,
      paused: true,
      due: false,
      planPriceWei: "5000000000000000000",
      planIntervalSeconds: 604800,
      planTokenAddress: buildDemoAddress("cccc"),
    },
  ];

  return {
    managerAddress: buildDemoAddress("feed"),
    chainId: 51,
    totalScanned: rows.length,
    activeCount: rows.filter((item) => item.active).length,
    pausedCount: rows.filter((item) => item.paused).length,
    dueCount: rows.filter((item) => item.due).length,
    rows,
    generatedAt: new Date().toISOString(),
  };
}
