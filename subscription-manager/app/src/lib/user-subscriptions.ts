import { getSubscription, getSubscriptionCount } from "./blockchain";
import { getTierByPlanId } from "./services";

const SUBSCRIPTION_MANAGER_ADDRESS = process.env.NEXT_PUBLIC_SUBSCRIPTION_MANAGER_ADDRESS || "";

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
    const count = await getSubscriptionCount(SUBSCRIPTION_MANAGER_ADDRESS);
    const subscriptions: UserSubscription[] = [];

    for (let i = 1; i <= count; i++) {
      const sub = await getSubscription(SUBSCRIPTION_MANAGER_ADDRESS, i);
      if (!sub) continue;

      // Filter by wallet and active status
      if (sub.subscriber.toLowerCase() !== walletAddress.toLowerCase()) continue;
      if (!sub.active) continue;

      const serviceInfo = getTierByPlanId(sub.planId);

      subscriptions.push({
        subscriptionId: sub.subscriptionId,
        planId: sub.planId,
        subscriber: sub.subscriber,
        nextRenewalAt: sub.nextRenewalAt,
        active: sub.active,
        paused: sub.paused,
        serviceName: serviceInfo?.service.name || `Service ${sub.planId}`,
        tierName: serviceInfo?.tier.name || `Plan ${sub.planId}`,
        logo: serviceInfo?.service.logo || "",
        priceLabel: serviceInfo?.tier.priceLabel || "",
        tokenSymbol: serviceInfo?.service.id === "netflix" ? "NFX" :
                    serviceInfo?.service.id === "spotify" ? "SPF" :
                    serviceInfo?.service.id === "youtube" ? "YTB" :
                    serviceInfo?.service.id === "jiohotstar" ? "JHS" :
                    serviceInfo?.service.id === "claude" ? "CLA" :
                    serviceInfo?.service.id === "copilot" ? "COP" : "TOKEN",
      });
    }

    return subscriptions;
  } catch (error) {
    console.error("Failed to fetch user subscriptions:", error);
    return [];
  }
}
