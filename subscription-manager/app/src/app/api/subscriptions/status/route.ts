import { NextResponse } from "next/server";

import { fetchOnchainSubscriptionSnapshot } from "@/lib/onchain-subscriptions";

let cache: { data: any; timestamp: number } | null = null;
const CACHE_TTL_MS = 15000; // 15 seconds

export async function GET() {
  try {
    // Return cached data if fresh
    if (cache && Date.now() - cache.timestamp < CACHE_TTL_MS) {
      return NextResponse.json(cache.data);
    }

    const snapshot = await fetchOnchainSubscriptionSnapshot();
    cache = { data: snapshot, timestamp: Date.now() };
    return NextResponse.json(snapshot);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown status error";
    // Return error without fake demo data
    return NextResponse.json({ error: message, rows: [] }, { status: 500 });
  }
}
