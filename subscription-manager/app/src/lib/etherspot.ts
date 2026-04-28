import { APOTHEM_CHAIN } from "@/config/chains";
import { ModularSdk, EtherspotBundler } from "@etherspot/modular-sdk";
import { encodeFunctionData, parseAbi } from "viem";

const chainId = APOTHEM_CHAIN.chainIdDecimal;
const bundlerUrl = process.env.NEXT_PUBLIC_BUNDLER_URL || "https://testnet-rpc.etherspot.io/v1/51?api-key=etherspot_AA2QUX5f6tqxLEA8hC7XQu";
const arkaApiKey = process.env.NEXT_PUBLIC_ARKA_API_KEY || "etherspot_AA2QUX5f6tqxLEA8hC7XQu";
const arkaUrl = "https://rpc.etherspot.io/paymaster";

/**
 * Build the Arka paymaster URL with query params.
 * useVp=true tells Arka to use the deployed Verifying Paymaster.
 */
function getArkaUrl(): string {
  return `${arkaUrl}?apiKey=${arkaApiKey}&chainId=${chainId}&useVp=true`;
}

export type GasMode = "sponsor" | "erc20" | "multi-token";

/**
 * Create a ModularSdk instance wired to the Etherspot bundler on XDC Apothem.
 */
function createSdk(privateKey: string): ModularSdk {
  const url = new URL(bundlerUrl);
  const apiKey = url.searchParams.get("api-key") || undefined;
  const baseUrl = `${url.protocol}//${url.host}${url.pathname}`;

  const bundlerProvider = new EtherspotBundler(chainId, apiKey, baseUrl);

  return new ModularSdk(privateKey, {
    chainId,
    bundlerProvider,
    entryPointAddress: process.env.NEXT_PUBLIC_ENTRYPOINT_ADDRESS || "0x0000000071727De22E5E9d8BAf0edAc6f37da032",
    walletFactoryAddress: process.env.NEXT_PUBLIC_SIMPLE_ACCOUNT_FACTORY_ADDRESS || "0x91E60e0613810449d098b0b5Ec8b51A0FE8c8985",
  });
}

/**
 * Get the smart account counterfactual address for an EOA owner.
 */
export async function getSmartAccountAddress(privateKey: string): Promise<string> {
  const sdk = createSdk(privateKey);
  return sdk.getCounterFactualAddress();
}

// ── ABI helpers ──

const managerAbi = parseAbi([
  "function subscribe(uint256 planId) returns (uint256 subscriptionId)",
  "function renew(uint256 subscriptionId)",
  "function pause(uint256 subscriptionId)",
  "function cancel(uint256 subscriptionId)",
]);

const erc20Abi = parseAbi([
  "function approve(address spender, uint256 amount) returns (bool)",
]);

// ── Core AA Flow ──

/**
 * Subscribe via real Account Abstraction using Etherspot SDK.
 *
 * Flow:
 * 1. sdk.clearUserOpsFromBatch()
 * 2. sdk.addUserOpsToBatch({ to, data }) — encode subscribe call (and approve for ERC20)
 * 3. sdk.estimate({ paymasterDetails: { url, context } })
 * 4. sdk.send(op)
 * 5. sdk.getUserOpReceipt(uoHash) — poll
 */
export async function sendSubscriptionUserOp(
  privateKey: string,
  subscriptionManagerAddress: string,
  planId: number,
  mode: GasMode,
  tokenAddress?: string,
  price?: string
): Promise<{ txHash: string; explorerUrl: string; userOpHash: string }> {
  const sdk = createSdk(privateKey);

  console.log("[EtherspotAA] Mode:", mode);

  // 1. Clear any previous batch
  await sdk.clearUserOpsFromBatch();

  // 2. For ERC20 mode: add approve call to batch first
  if ((mode === "erc20" || mode === "multi-token") && tokenAddress && price) {
    const approveData = encodeFunctionData({
      abi: erc20Abi,
      functionName: "approve",
      args: [subscriptionManagerAddress as `0x${string}`, BigInt(price) * BigInt(10)],
    });
    await sdk.addUserOpsToBatch({ to: tokenAddress, data: approveData });
    console.log("[EtherspotAA] Added approve to batch");
  }

  // 3. Add subscribe transaction to batch
  const subscribeData = encodeFunctionData({
    abi: managerAbi,
    functionName: "subscribe",
    args: [BigInt(planId)],
  });
  await sdk.addUserOpsToBatch({ to: subscriptionManagerAddress, data: subscribeData });
  console.log("[EtherspotAA] Added subscribe to batch");

  // 4. Build paymaster context
  const paymasterUrl = getArkaUrl();
  const context = mode === "sponsor" || mode === "multi-token"
    ? { mode: "sponsor" }
    : { mode: "commonerc20", token: tokenAddress };

  console.log("[EtherspotAA] Paymaster URL:", paymasterUrl);
  console.log("[EtherspotAA] Context:", context);

  // 5. Estimate with paymaster
  console.log("[EtherspotAA] Estimating UserOp...");
  const userOp = await sdk.estimate({
    paymasterDetails: {
      url: paymasterUrl,
      context,
    },
  });
  console.log("[EtherspotAA] Estimated:", userOp);

  // 6. Send to bundler
  console.log("[EtherspotAA] Sending UserOp to bundler...");
  const userOpHash = await sdk.send(userOp);
  console.log("[EtherspotAA] UserOpHash:", userOpHash);

  // 7. Poll for receipt
  console.log("[EtherspotAA] Waiting for receipt...");
  const txHash = await pollForReceipt(sdk, userOpHash);
  console.log("[EtherspotAA] TxHash:", txHash);

  const explorerUrl = `${APOTHEM_CHAIN.explorerUrl}tx/${txHash}`;
  return { txHash, explorerUrl, userOpHash };
}

/**
 * Renew / Pause / Cancel via AA.
 */
export async function sendLifecycleUserOp(
  privateKey: string,
  subscriptionManagerAddress: string,
  subscriptionId: number,
  action: "renew" | "pause" | "cancel",
  mode: GasMode = "sponsor"
): Promise<{ txHash: string; explorerUrl: string; userOpHash: string }> {
  const sdk = createSdk(privateKey);

  await sdk.clearUserOpsFromBatch();

  const data = encodeFunctionData({
    abi: managerAbi,
    functionName: action,
    args: [BigInt(subscriptionId)],
  });
  await sdk.addUserOpsToBatch({ to: subscriptionManagerAddress, data });

  const paymasterUrl = getArkaUrl();
  const context = { mode: "sponsor" };

  const userOp = await sdk.estimate({
    paymasterDetails: { url: paymasterUrl, context },
  });

  const userOpHash = await sdk.send(userOp);
  const txHash = await pollForReceipt(sdk, userOpHash);

  const explorerUrl = `${APOTHEM_CHAIN.explorerUrl}tx/${txHash}`;
  return { txHash, explorerUrl, userOpHash };
}

// ── Helpers ──

async function pollForReceipt(sdk: ModularSdk, userOpHash: string, timeoutMs = 120000): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await sleep(2000);
    try {
      const receipt = await sdk.getUserOpReceipt(userOpHash);
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
