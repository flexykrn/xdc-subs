import { encodeFunctionData, parseAbi } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { submitUserOp, getCounterFactualAddress, getNonce, type GasMode } from "@/lib/aa-core";

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

    await submitUserOp({
      privateKey: privateKey as `0x${string}`,
      callData: approveData,
      mode,
      nonce: currentNonce,
    });
    currentNonce = currentNonce + 1n;
  }

  // Build subscribe calldata
  const callData = encodeFunctionData({
    abi: subscriptionManagerAbi,
    functionName: "subscribe",
    args: [BigInt(planId)],
  });

  return await submitUserOp({
    privateKey: privateKey as `0x${string}`,
    callData,
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
  const callData = encodeFunctionData({
    abi: subscriptionManagerAbi,
    functionName: action,
    args: [BigInt(subscriptionId)],
  });

  return await submitUserOp({
    privateKey: privateKey as `0x${string}`,
    callData,
    mode: "sponsor",
  });
}