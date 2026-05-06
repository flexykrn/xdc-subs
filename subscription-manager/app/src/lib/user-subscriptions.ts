import { createPublicClient, http, parseAbi, hexToBigInt } from "viem";
import { getTierByPlanId } from "./services";

const SUBSCRIPTION_MANAGER_ADDRESS = process.env.NEXT_PUBLIC_SUBSCRIPTION_MANAGER_ADDRESS || "";
const RPC_URL = process.env.NEXT_PUBLIC_APOTHEM_RPC_URL || "https://erpc.apothem.network";

const publicClient = createPublicClient({ transport: http(RPC_URL) });

const subManagerAbi = parseAbi([
  "function subscriptions(uint256) view returns (address subscriber, uint256 planId, uint256 nextRenewalAt, bool active, bool paused)",
  "event Subscribed(uint256 indexed subscriptionId, uint256 indexed planId, address indexed subscriber, uint256 nextRenewalAt)",
]);

export interface UserSubscription {
  subscriptionId: number;
  planId: number;
  subscriber: string;
  nextRenewalAt: number;
  active: boolean;
  paused: boolean;
  serviceName: string;
  tierName: string;
  logo: string;
  priceLabel: string;
  tokenSymbol: string;
}

export async function getUserSubscriptions(walletAddress: string): Promise<UserSubscription[]> {
  if (!SUBSCRIPTION_MANAGER_ADDRESS || !walletAddress) return [];

  try {
    // Use event logs to find subscriptions for this user (much faster than scanning all)
    const logs = await publicClient.getLogs({
      address: SUBSCRIPTION_MANAGER_ADDRESS as `0x${string}`,
      event: subManagerAbi[1], // Subscribed event
      args: { subscriber: walletAddress as `0x${string}` },
      fromBlock: 0n,
      toBlock: "latest",
    });

    if (logs.length === 0) return [];

    // Fetch subscription details for each found subscription
    const subscriptions: UserSubscription[] = [];
    
    for (const log of logs) {
      const subId = Number(hexToBigInt(log.topics[1] as `0x${string}`));
      
      try {
        const sub = await publicClient.readContract({
          address: SUBSCRIPTION_MANAGER_ADDRESS as `0x${string}`,
          abi: subManagerAbi,
          functionName: "subscriptions",
          args: [BigInt(subId)],
        });

        if (!sub[3]) continue; // skip inactive

        const serviceInfo = getTierByPlanId(Number(sub[1]));

        subscriptions.push({
          subscriptionId: subId,
          planId: Number(sub[1]),
          subscriber: sub[0],
          nextRenewalAt: Number(sub[2]),
          active: sub[3],
          paused: sub[4],
          serviceName: serviceInfo?.service.name || `Service ${sub[1]}`,
          tierName: serviceInfo?.tier.name || `Plan ${sub[1]}`,
          logo: serviceInfo?.service.logo || "",
          priceLabel: serviceInfo?.tier.priceLabel || "",
          tokenSymbol: "SUB",
        });
      } catch {
        // Skip if subscription fetch fails
      }
    }

    return subscriptions;
  } catch (error) {
    console.error("Failed to fetch user subscriptions:", error);
    return [];
  }
}
