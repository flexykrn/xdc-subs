import { encodeFunctionData, parseAbi } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { submitUserOp, getCounterFactualAddress, getNonce, buildExecuteCallData, type GasMode } from "@/lib/aa-core";

const subscriptionManagerAbi = parseAbi([
  "function subscribe(uint256 planId) returns (uint256 subscriptionId)",
  "function renew(uint256 subscriptionId)",
  "function pause(uint256 subscriptionId)",
  "function cancel(uint256 subscriptionId)",
]);

const erc20Abi = parseAbi([
  "function approve(address spender, uint256 amount) returns (bool)",
]);

export async function executeAASubscription(
  privateKey: string,
  contractAddress: string,
  planId: number,
  mode: GasMode = "sponsor",
  tokenAddress?: string,
  price?: string,
): Promise<{ userOpHash: string; txHash: string }> {
  // Get smart account and starting nonce
  const owner = privateKeyToAccount(privateKey as `0x${string}`).address;
  const sa = await getCounterFactualAddress(owner);
  let currentNonce = await getNonce(sa);

  // ALWAYS approve first — subscription requires token payment regardless of gas mode
  if (tokenAddress && price) {
    const approveData = encodeFunctionData({
      abi: erc20Abi,
      functionName: "approve",
      args: [contractAddress as `0x${string}`, BigInt(price)],
    });

    // Wrap in execute() so SimpleAccount can call the token contract
    const executeApprove = buildExecuteCallData(tokenAddress as `0x${string}`, approveData);

    await submitUserOp({
      privateKey: privateKey as `0x${string}`,
      callData: executeApprove,
      mode,
      nonce: currentNonce,
    });
    currentNonce = currentNonce + 1n;
  }

  // Build subscribe calldata
  const subscribeData = encodeFunctionData({
    abi: subscriptionManagerAbi,
    functionName: "subscribe",
    args: [BigInt(planId)],
  });

  // Wrap in execute() so SimpleAccount can call SubscriptionManager
  const executeSubscribe = buildExecuteCallData(contractAddress as `0x${string}`, subscribeData);

  return await submitUserOp({
    privateKey: privateKey as `0x${string}`,
    callData: executeSubscribe,
    mode,
    nonce: currentNonce,
  });
}

export async function executeAALifecycle(
  privateKey: string,
  contractAddress: string,
  subscriptionId: number,
  action: "renew" | "pause" | "cancel",
): Promise<{ userOpHash: string; txHash: string }> {
  const innerCallData = encodeFunctionData({
    abi: subscriptionManagerAbi,
    functionName: action,
    args: [BigInt(subscriptionId)],
  });

  const executeCallData = buildExecuteCallData(contractAddress as `0x${string}`, innerCallData);

  return await submitUserOp({
    privateKey: privateKey as `0x${string}`,
    callData: executeCallData,
    mode: "sponsor",
  });
}
