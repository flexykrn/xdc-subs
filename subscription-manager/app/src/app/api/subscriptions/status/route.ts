import { NextResponse } from "next/server";

import { buildDemoOnchainSubscriptionSnapshot, fetchOnchainSubscriptionSnapshot } from "@/lib/onchain-subscriptions";

export async function GET() {
  try {
    const snapshot = await fetchOnchainSubscriptionSnapshot();
    return NextResponse.json(snapshot);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown status error";
    const demoSnapshot = buildDemoOnchainSubscriptionSnapshot();
    return NextResponse.json({ ...demoSnapshot, error: message, demo: true });
  }
}
