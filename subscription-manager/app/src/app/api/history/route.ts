import { NextRequest, NextResponse } from "next/server";
import { fetchSubscriptionEventsForUser, type OnchainEvent } from "@/lib/blockchain-events";

interface CachedData {
  events: OnchainEvent[];
  lastBlock: bigint;
  timestamp: number;
}

const cache = new Map<string, CachedData>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const SCAN_INCREMENT = 500n; // blocks per incremental scan

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const address = url.searchParams.get("address");

  if (!address || !address.match(/^0x[0-9a-fA-F]{40}$/)) {
    return NextResponse.json({ error: "Invalid address" }, { status: 400 });
  }

  const now = Date.now();
  const cached = cache.get(address.toLowerCase());

  // Return cached if fresh
  if (cached && now - cached.timestamp < CACHE_TTL_MS) {
    const serializedEvents = cached.events.map(e => ({
      ...e,
      blockNumber: e.blockNumber.toString(),
    }));
    return NextResponse.json({
      events: serializedEvents,
      lastBlock: cached.lastBlock.toString(),
      cached: true,
      count: cached.events.length,
    });
  }

  try {
    let events: OnchainEvent[];
    let lastBlock: bigint;

    if (cached) {
      // Incremental scan from last known block
      const newEvents = await fetchSubscriptionEventsForUser(
        address as `0x${string}`,
        cached.lastBlock + 1n,
      );
      // Merge and deduplicate
      const seen = new Set(cached.events.map(e => e.txHash + e.type));
      const merged = [...cached.events];
      for (const ev of newEvents) {
        const key = ev.txHash + ev.type;
        if (!seen.has(key)) {
          merged.push(ev);
          seen.add(key);
        }
      }
      events = merged.sort((a, b) => Number(b.blockNumber - a.blockNumber));
      lastBlock = cached.lastBlock + SCAN_INCREMENT; // approximate
    } else {
      // Full scan (first time)
      events = await fetchSubscriptionEventsForUser(address as `0x${string}`);
      lastBlock = events.length > 0 
        ? events[0].blockNumber 
        : await getLatestBlock();
    }

    cache.set(address.toLowerCase(), {
      events,
      lastBlock,
      timestamp: now,
    });

    // Serialize BigInt to string for JSON
    const serializedEvents = events.map(e => ({
      ...e,
      blockNumber: e.blockNumber.toString(),
    }));

    return NextResponse.json({
      events: serializedEvents,
      lastBlock: lastBlock.toString(),
      cached: false,
      count: events.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[History API] Error:", message, error);
    return NextResponse.json({ error: message, stack: error instanceof Error ? error.stack : undefined }, { status: 500 });
  }
}

async function getLatestBlock(): Promise<bigint> {
  const { createPublicClient, http } = await import("viem");
  const client = createPublicClient({
    transport: http(process.env.NEXT_PUBLIC_APOTHEM_RPC_URL || "https://erpc.apothem.network"),
  });
  return client.getBlockNumber();
}
