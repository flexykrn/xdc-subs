import { createPublicClient, http, parseAbi, keccak256, toBytes, hexToBigInt } from "viem";

const RPC_URL = process.env.NEXT_PUBLIC_APOTHEM_RPC_URL || "https://erpc.apothem.network";
const SUBMAN = (process.env.NEXT_PUBLIC_SUBSCRIPTION_MANAGER_ADDRESS || "0xe8271C9Bc2255A41cd2AB53FbfB69CE4B5f3032E") as `0x${string}`;
const ENTRYPOINT = (process.env.NEXT_PUBLIC_ENTRYPOINT_ADDRESS || "0x0000000071727De22E5E9d8BAf0edAc6f37da032") as `0x${string}`;

const publicClient = createPublicClient({ transport: http(RPC_URL) });

// Event signature hashes
const SIG_SUBSCRIBED = keccak256(toBytes("Subscribed(uint256,uint256,address,uint256)"));
const SIG_RENEWED = keccak256(toBytes("Renewed(uint256,uint256)"));
const SIG_PAUSED = keccak256(toBytes("Paused(uint256)"));
const SIG_CANCELLED = keccak256(toBytes("Cancelled(uint256)"));

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
  const latest = toBlock || await publicClient.getBlockNumber();
  const start = fromBlock || (latest > 10000n ? latest - 10000n : 0n);

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

  // Fetch SubscriptionManager logs
  const subLogs = await publicClient.getLogs({
    address: SUBMAN,
    events: subAbi,
    fromBlock: start,
    toBlock: latest,
  });

  for (const log of subLogs) {
    const sig = log.topics[0]?.toLowerCase();
    const block = await publicClient.getBlock({ blockNumber: log.blockNumber });
    const ts = Number(block.timestamp) * 1000;

    if (sig === SIG_SUBSCRIBED.toLowerCase()) {
      const subId = hexToBigInt(log.topics[1] as `0x${string}`).toString();
      const planId = hexToBigInt(log.topics[2] as `0x${string}`).toString();
      const subscriber = ("0x" + (log.topics[3] || "").slice(26)) as `0x${string}`;
      if (subscriber.toLowerCase() === userAddress.toLowerCase()) {
        events.push({
          type: "subscribed",
          txHash: log.transactionHash,
          blockNumber: log.blockNumber,
          timestamp: ts,
          subscriptionId: subId,
          planId,
          subscriber,
          status: "success",
        });
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

  // Fetch EntryPoint UserOp revert events for this user
  const entryLogs = await publicClient.getLogs({
    address: ENTRYPOINT,
    event: entryAbi[0],
    args: { sender: userAddress },
    fromBlock: start,
    toBlock: latest,
  });

  for (const log of entryLogs) {
    const block = await publicClient.getBlock({ blockNumber: log.blockNumber });
    events.push({
      type: "userOp",
      txHash: log.transactionHash,
      blockNumber: log.blockNumber,
      timestamp: Number(block.timestamp) * 1000,
      userOpHash: log.topics[1],
      status: "failed",
    });
  }

  return events.sort((a, b) => Number(b.blockNumber - a.blockNumber));
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
