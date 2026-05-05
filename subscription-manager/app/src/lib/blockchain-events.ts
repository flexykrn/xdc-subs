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
const CACHE_TTL_MS = 30000; // 30 seconds

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
  const start = fromBlock || (latest > 5000n ? latest - 5000n : 0n); // Reduced from 10k to 5k

  const events: OnchainEvent[] = [];

  const subAbi = parseAbi([
    "event Subscribed(uint256 indexed subscriptionId, uint256 indexed planId, address indexed subscriber, uint256 nextRenewalAt)",
    "event Renewed(uint256 indexed subscriptionId, uint256 nextRenewalAt)",
    "event Paused(uint256 indexed subscriptionId)",
    "event Cancelled(uint256 indexed subscriptionId)",
  ]);

  const entryAbi = parseAbi([
    "event UserOperationRevertReason(bytes32 indexed userOpHash, address indexed sender, uint256 nonce, bytes revertReason)",
  ]);

  // Fetch logs in parallel
  const [subLogs, entryLogs] = await Promise.all([
    publicClient.getLogs({
      address: SUBMAN,
      events: subAbi,
      fromBlock: start,
      toBlock: latest,
    }),
    publicClient.getLogs({
      address: ENTRYPOINT,
      event: entryAbi[0],
      args: { sender: userAddress },
      fromBlock: start,
      toBlock: latest,
    }),
  ]);

  // Collect unique block numbers and fetch all blocks in parallel
  const blockNumbers = new Set<bigint>();
  subLogs.forEach(l => blockNumbers.add(l.blockNumber));
  entryLogs.forEach(l => blockNumbers.add(l.blockNumber));
  
  const blockMap = new Map<bigint, number>();
  const blocks = await Promise.all(
    Array.from(blockNumbers).map(bn => publicClient.getBlock({ blockNumber: bn }))
  );
  blocks.forEach(b => blockMap.set(b.number, Number(b.timestamp) * 1000));

  // Process SubscriptionManager logs
  for (const log of subLogs) {
    const sig = log.topics[0]?.toLowerCase();
    const ts = blockMap.get(log.blockNumber) || 0;

    if (sig === SIG_SUBSCRIBED.toLowerCase()) {
      const subId = hexToBigInt(log.topics[1] as `0x${string}`).toString();
      const planId = hexToBigInt(log.topics[2] as `0x${string}`).toString();
      const subscriber = ("0x" + (log.topics[3] || "").slice(26)) as `0x${string}`;
      if (subscriber.toLowerCase() === userAddress.toLowerCase()) {
        events.push({ type: "subscribed", txHash: log.transactionHash, blockNumber: log.blockNumber, timestamp: ts, subscriptionId: subId, planId, subscriber, status: "success" });
      }
    } else if (sig === SIG_RENEWED.toLowerCase()) {
      const subId = hexToBigInt(log.topics[1] as `0x${string}`).toString();
      await addIfUserSubscription(subId, userAddress, events, log, ts, "renewed");
    } else if (sig === SIG_PAUSED.toLowerCase()) {
      const subId = hexToBigInt(log.topics[1] as `0x${string}`).toString();
      await addIfUserSubscription(subId, userAddress, events, log, ts, "paused");
    } else if (sig === SIG_CANCELLED.toLowerCase()) {
      const subId = hexToBigInt(log.topics[1] as `0x${string}`).toString();
      await addIfUserSubscription(subId, userAddress, events, log, ts, "cancelled");
    }
  }

  // Process EntryPoint logs
  for (const log of entryLogs) {
    const ts = blockMap.get(log.blockNumber) || 0;
    events.push({ type: "userOp", txHash: log.transactionHash, blockNumber: log.blockNumber, timestamp: ts, userOpHash: log.topics[1], status: "failed" });
  }

  const sorted = events.sort((a, b) => Number(b.blockNumber - a.blockNumber));
  
  // Update cache
  cache = { events: sorted, userAddress, timestamp: Date.now() };
  return sorted;
}

async function addIfUserSubscription(
  subscriptionId: string,
  userAddress: `0x${string}`,
  events: OnchainEvent[],
  log: any,
  timestamp: number,
  type: "renewed" | "paused" | "cancelled",
) {
  try {
    const sub = await publicClient.readContract({
      address: SUBMAN,
      abi: parseAbi(["function subscriptions(uint256) view returns (address subscriber, uint256 planId, uint256 nextRenewalAt, bool active, bool paused)"]),
      functionName: "subscriptions",
      args: [BigInt(subscriptionId)],
    });
    if (sub[0].toLowerCase() === userAddress.toLowerCase()) {
      events.push({
        type,
        txHash: log.transactionHash,
        blockNumber: log.blockNumber,
        timestamp,
        subscriptionId,
        status: "success",
      });
    }
  } catch { /* skip */ }
}
