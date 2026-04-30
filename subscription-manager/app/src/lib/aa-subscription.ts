import { encodeFunctionData, parseAbi } from "viem";
import { PrimeSdk } from "@etherspot/prime-sdk";

const subscriptionManagerAbi = parseAbi([
  "function subscribe(uint256 planId) returns (uint256 subscriptionId)",
  "function renew(uint256 subscriptionId)",
  "function pause(uint256 subscriptionId)",
  "function cancel(uint256 subscriptionId)",
]);

const erc20Abi = parseAbi([
  "function approve(address spender, uint256 amount) returns (bool)",
]);

const chainId = 51;

function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`Missing env var: ${name}. Check .env.local`);
  return val;
}

function getArkaUrl(): string {
  const key = requireEnv("NEXT_PUBLIC_ARKA_API_KEY");
  return `https://rpc.etherspot.io/paymaster?apiKey=${key}&chainId=${chainId}&useVp=true`;
}

export type GasMode = "sponsor" | "erc20" | "multi-token";

export async function executeAASubscription(
  primeSdk: PrimeSdk,
  contractAddress: string,
  planId: number,
  mode: GasMode = "sponsor",
  tokenAddress?: string,
  price?: string,
): Promise<{ userOpHash: string; txHash: string }> {
  // Build subscribe calldata
  const callData = encodeFunctionData({
    abi: subscriptionManagerAbi,
    functionName: "subscribe",
    args: [BigInt(planId)],
  });

  // Clear batch
  await primeSdk.clearUserOpsFromBatch();

  // For ERC20 mode: add approve call first
  if ((mode === "erc20" || mode === "multi-token") && tokenAddress && price) {
    const approveData = encodeFunctionData({
      abi: erc20Abi,
      functionName: "approve",
      args: [contractAddress as `0x${string}`, BigInt(price) * BigInt(10)],
    });
    await primeSdk.addUserOpsToBatch({ to: tokenAddress, data: approveData });
  }

  // Add subscribe call to batch
  await primeSdk.addUserOpsToBatch({
    to: contractAddress,
    data: callData,
  });

  // Attach Arka Paymaster if sponsored
  const paymasterDetails =
    mode === "sponsor" || mode === "multi-token"
      ? {
          url: getArkaUrl(),
          context: { mode: "sponsor" },
        }
      : {
          url: getArkaUrl(),
          context: { mode: "commonerc20", token: tokenAddress },
        };

  // Estimate
  const userOp = await primeSdk.estimate({ paymasterDetails });

  // Send
  const userOpHash = await primeSdk.send(userOp);

  // Poll for receipt
  const txHash = await pollForReceipt(primeSdk, userOpHash);

  return { userOpHash, txHash };
}

export async function executeAALifecycle(
  primeSdk: PrimeSdk,
  contractAddress: string,
  subscriptionId: number,
  action: "renew" | "pause" | "cancel",
): Promise<{ userOpHash: string; txHash: string }> {
  const callData = encodeFunctionData({
    abi: subscriptionManagerAbi,
    functionName: action,
    args: [BigInt(subscriptionId)],
  });

  await primeSdk.clearUserOpsFromBatch();
  await primeSdk.addUserOpsToBatch({ to: contractAddress, data: callData });

  const paymasterDetails = {
    url: getArkaUrl(),
    context: { mode: "sponsor" },
  };

  const userOp = await primeSdk.estimate({ paymasterDetails });
  const userOpHash = await primeSdk.send(userOp);
  const txHash = await pollForReceipt(primeSdk, userOpHash);

  return { userOpHash, txHash };
}

async function pollForReceipt(
  primeSdk: PrimeSdk,
  userOpHash: string,
  timeoutMs = 120000,
): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await sleep(2000);
    try {
      const receipt = await primeSdk.getUserOpReceipt(userOpHash);
      if (receipt) return receipt;
    } catch {
      // retry
    }
  }
  return userOpHash; // fallback
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
