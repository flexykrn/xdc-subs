import { encodeFunctionData, parseAbi } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { submitUserOp, getCounterFactualAddress, getNonce, buildExecuteCallData, buildExecuteBatchCallData, type GasMode } from "@/lib/aa-core";

const subscriptionManagerAbi = parseAbi([
  "function subscribe(uint256 planId) returns (uint256 subscriptionId)",
  "function renew(uint256 subscriptionId)",
  "function pause(uint256 subscriptionId)",
  "function cancel(uint256 subscriptionId)",
]);

const erc20Abi = parseAbi([
  "function approve(address spender, uint256 amount) returns (bool)",
]);

// ── Batched Subscribe (Approve + Subscribe in ONE UserOp) ──

export async function executeAASubscription(
  privateKey: string,
  contractAddress: string,
  planId: number,
  mode: GasMode = "sponsor",
  tokenAddress?: string,
  price?: string,
): Promise<{ userOpHash: string; txHash: string }> {
  const owner = privateKeyToAccount(privateKey as `0x${string}`).address;
  const sa = await getCounterFactualAddress(owner);
  const nonce = await getNonce(sa);

  // Build batch: approve + subscribe in ONE UserOp
  const targets: `0x${string}`[] = [];
  const values: bigint[] = [];
  const datas: `0x${string}`[] = [];

  // 1. Approve token spending (if token + price provided)
  if (tokenAddress && price) {
    const approveData = encodeFunctionData({
      abi: erc20Abi,
      functionName: "approve",
      args: [contractAddress as `0x${string}`, BigInt(price)],
    });
    targets.push(tokenAddress as `0x${string}`);
    values.push(0n);
    datas.push(approveData);
  }

  // 2. Subscribe call
  const subscribeData = encodeFunctionData({
    abi: subscriptionManagerAbi,
    functionName: "subscribe",
    args: [BigInt(planId)],
  });
  targets.push(contractAddress as `0x${string}`);
  values.push(0n);
  datas.push(subscribeData);

  // 3. Wrap in executeBatch for SimpleAccount
  const batchCallData = buildExecuteBatchCallData(targets, values, datas);

  // 4. Submit as single UserOp
  const result = await submitUserOp({
    privateKey: privateKey as `0x${string}`,
    callData: batchCallData,
    mode,
    nonce,
  });

  return result;
}

// ── Lifecycle Actions (single call per UserOp) ──

export async function executeAALifecycle(
  privateKey: string,
  contractAddress: string,
  subscriptionId: number,
  action: "renew" | "pause" | "cancel",
  mode: GasMode = "sponsor",
  tokenAddress?: string,
  price?: string,
): Promise<{ userOpHash: string; txHash: string }> {
  const owner = privateKeyToAccount(privateKey as `0x${string}`).address;
  const sa = await getCounterFactualAddress(owner);
  const nonce = await getNonce(sa);

  const actionData = encodeFunctionData({
    abi: subscriptionManagerAbi,
    functionName: action,
    args: [BigInt(subscriptionId)],
  });

  const callData = buildExecuteCallData(contractAddress as `0x${string}`, actionData);

  const result = await submitUserOp({
    privateKey: privateKey as `0x${string}`,
    callData,
    mode,
    nonce,
  });

  return result;
}
