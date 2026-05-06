import { createPublicClient, http, parseAbi, keccak256, toBytes, hexToBigInt } from "viem";

const RPC_URL = process.env.NEXT_PUBLIC_APOTHEM_RPC_URL || "https://erpc.apothem.network";
const SUBMAN = process.env.NEXT_PUBLIC_SUBSCRIPTION_MANAGER_ADDRESS as `0x${string}`;
if (!SUBMAN || SUBMAN === "0x") {
  throw new Error("NEXT_PUBLIC_SUBSCRIPTION_MANAGER_ADDRESS not set in environment");
}

const ENTRYPOINT = process.env.NEXT_PUBLIC_ENTRYPOINT_ADDRESS as `0x${string}`;
if (!ENTRYPOINT || ENTRYPOINT === "0x") {
  throw new Error("NEXT_PUBLIC_ENTRYPOINT_ADDRESS not set in environment");
}

const publicClient = createPublicClient({ transport: http(RPC_URL) });

// Event signature hashes
const SIG_SUBSCRIBED = keccak256(toBytes("Subscribed(uint256,uint256,address,uint256)"));
const SIG_RENEWED = keccak256(toBytes("Renewed(uint256,uint256)"));
const SIG_PAUSED = keccak256(toBytes("Paused(uint256)"));
const SIG_CANCELLED = keccak256(toBytes("Cancelled(uint256)"));

// In-memory cache
let cache: { events: OnchainEvent[]; userAddress: string; timestamp: number } | null = null;
const CACHE_TTL_MS = 60000; // 60 seconds (doubled)

// BLOCK_SCAN_RANGE: 0 = scan all blocks from genesis (for testnet with few transactions)
const BLOCK_SCAN_RANGE = 0;

export interface OnchainEvent {
  type: "subscribed" | "renewed" | "paused" | "cancelled" | "userOp";
  txHash: string;
  blockNumber: bigint;
  timestamp: number;
  subscriptionId?: string;
  planId?: string;
  subscriber?: string;
  userOpHash?: string;
  nonce?: string;
  status: "success" | "failed";
}

export async function fetchSubscriptionEventsForUser(
  userAddress: `0x${string}`,
  fromBlock?: bigint,
  toBlock?: bigint,
): Promise<OnchainEvent[]> {
  // Return cached data if fresh
  if (cache && cache.userAddress.toLowerCase() === userAddress.toLowerCase() && Date.now() - cache.timestamp < CACHE_TTL_MS) {
    return cache.events;
  }

  const latest = toBlock || await publicClient.getBlockNumber();
  const start = fromBlock || (BLOCK_SCAN_RANGE > 0 && latest > BigInt(BLOCK_SCAN_RANGE) ? latest - BigInt(BLOCK_SCAN_RANGE) : 0n);

  const events: OnchainEvent[] = [];
  const userSubIds = new Set<string>(); // Track user's subscription IDs

  const subAbi = parseAbi([
    "event Subscribed(uint256 indexed subscriptionId, uint256 indexed planId, address indexed subscriber, uint256 nextRenewalAt)",
    "event Renewed(uint256 indexed subscriptionId, uint256 nextRenewalAt)",
    "event Paused(uint256 indexed subscriptionId)",
    "event Cancelled(uint256 indexed subscriptionId)",
  ]);

  // Fetch ONLY SubscriptionManager logs (skip EntryPoint - too slow, too many logs)
  const subLogs = await publicClient.getLogs({
    address: SUBMAN,
    events: subAbi,
    fromBlock: start,
    toBlock: latest,
  });

  // First pass: collect all Subscribed events for this user to build subscription ID set
  const userSubscribedLogs = subLogs.filter(log => {
    const sig = log.topics[0]?.toLowerCase();
    if (sig !== SIG_SUBSCRIBED.toLowerCase()) return false;
    const subscriber = ("0x" + (log.topics[3] || "").slice(26)) as `0x${string}`;
    return subscriber.toLowerCase() === userAddress.toLowerCase();
  });

  // Build set of user's subscription IDs
  for (const log of userSubscribedLogs) {
    const subId = hexToBigInt(log.topics[1] as `0x${string}`).toString();
    userSubIds.add(subId);
  }

  // If user has no subscriptions, return early (fast!)
  if (userSubIds.size === 0) {
    cache = { events: [], userAddress, timestamp: Date.now() };
    return [];
  }

  // Collect unique block numbers for timestamp lookup
  const blockNumbers = new Set<bigint>();
  for (const log of subLogs) {
    const subId = hexToBigInt(log.topics[1] as `0x${string}`).toString();
    const sig = log.topics[0]?.toLowerCase();
    
    // Include only if: Subscribed for this user, OR Renewed/Paused/Cancelled for user's sub
    if (sig === SIG_SUBSCRIBED.toLowerCase()) {
      const subscriber = ("0x" + (log.topics[3] || "").slice(26)) as `0x${string}`;
      if (subscriber.toLowerCase() === userAddress.toLowerCase()) {
        blockNumbers.add(log.blockNumber);
      }
    } else if (
      (sig === SIG_RENEWED.toLowerCase() || sig === SIG_PAUSED.toLowerCase() || sig === SIG_CANCELLED.toLowerCase()) &&
      userSubIds.has(subId)
    ) {
      blockNumbers.add(log.blockNumber);
    }
  }

  // Fetch timestamps in parallel (max 50 blocks at a time to avoid overload)
  const blockMap = new Map<bigint, number>();
  const blockArray = Array.from(blockNumbers);
  const BATCH_SIZE = 50;
  for (let i = 0; i < blockArray.length; i += BATCH_SIZE) {
    const batch = blockArray.slice(i, i + BATCH_SIZE);
    const blocks = await Promise.all(
      batch.map(bn => publicClient.getBlock({ blockNumber: bn }))
    );
    blocks.forEach(b => blockMap.set(b.number, Number(b.timestamp) * 1000));
  }

  // Second pass: build events
  for (const log of subLogs) {
    const sig = log.topics[0]?.toLowerCase();
    const subId = hexToBigInt(log.topics[1] as `0x${string}`).toString();
    const ts = blockMap.get(log.blockNumber) || 0;

    if (sig === SIG_SUBSCRIBED.toLowerCase()) {
      const planId = hexToBigInt(log.topics[2] as `0x${string}`).toString();
      const subscriber = ("0x" + (log.topics[3] || "").slice(26)) as `0x${string}`;
      if (subscriber.toLowerCase() === userAddress.toLowerCase()) {
        events.push({ type: "subscribed", txHash: log.transactionHash, blockNumber: log.blockNumber, timestamp: ts, subscriptionId: subId, planId, subscriber, status: "success" });
      }
    } else if (
      (sig === SIG_RENEWED.toLowerCase() || sig === SIG_PAUSED.toLowerCase() || sig === SIG_CANCELLED.toLowerCase()) &&
      userSubIds.has(subId)
    ) {
      const type: "renewed" | "paused" | "cancelled" = 
        sig === SIG_RENEWED.toLowerCase() ? "renewed" :
        sig === SIG_PAUSED.toLowerCase() ? "paused" : "cancelled";
      events.push({ type, txHash: log.transactionHash, blockNumber: log.blockNumber, timestamp: ts, subscriptionId: subId, status: "success" });
    }
  }

  const sorted = events.sort((a, b) => Number(b.blockNumber - a.blockNumber));
  
  cache = { events: sorted, userAddress, timestamp: Date.now() };
  return sorted;
}
