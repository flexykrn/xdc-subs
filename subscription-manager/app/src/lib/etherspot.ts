import { APOTHEM_CHAIN } from "@/config/chains";
import { ModularSdk, EtherspotBundler } from "@etherspot/modular-sdk";

const chainId = APOTHEM_CHAIN.chainIdDecimal;
const bundlerUrl = process.env.NEXT_PUBLIC_BUNDLER_URL || "https://testnet-rpc.etherspot.io/v1/51";
const arkaApiKey = process.env.NEXT_PUBLIC_ARKA_API_KEY || "";

/**
 * Arka Paymaster URL — official Etherspot endpoint.
 * useVp=true tells Arka to use the deployed Verifying Paymaster.
 */
export function getArkaPaymasterUrl(): string {
  return `https://rpc.etherspot.io/paymaster?apiKey=${arkaApiKey}&chainId=${chainId}&useVp=true`;
}

export type GasMode = "sponsor" | "erc20" | "multi-token";

export interface PaymasterContext {
  mode: string;
  token?: string;
  validAfter?: number;
  validUntil?: number;
}

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
 * Build paymaster context following Arka docs exactly.
 * https://etherspot.fyi/arka/intro
 */
export function buildPaymasterContext(
  mode: GasMode,
  tokenAddress?: string
): PaymasterContext {
  const now = Date.now();

  if (mode === "sponsor") {
    return {
      mode: "sponsor",
      validAfter: now,
      validUntil: now + 6000000, // 100 mins expiry per Arka docs
    };
  }

  if (mode === "erc20" || mode === "multi-token") {
    if (!tokenAddress) {
      throw new Error("tokenAddress is required for ERC20 / multi-token mode");
    }
    return {
      mode: "commonerc20",
      token: tokenAddress,
    };
  }

  return { mode: "sponsor" };
}

/**
 * Get smart account address for an EOA.
 */
export async function getSmartAccountAddress(privateKey: string): Promise<string> {
  const sdk = createSdk(privateKey);
  return sdk.getCounterFactualAddress();
}

/**
 * Subscribe via real Account Abstraction (Etherspot + Arka).
 *
 * Flow per Arka docs:
 * 1. sdk.clearUserOpsFromBatch()
 * 2. sdk.addUserOpsToBatch({ to, data }) — encode subscribe call
 * 3. For ERC20: also add approve call to batch
 * 4. sdk.estimate({ paymasterDetails: { url, context } })
 * 5. sdk.send(op)
 * 6. sdk.getUserOpReceipt(uoHash) — poll
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
  const paymasterUrl = getArkaPaymasterUrl();
  const context = buildPaymasterContext(mode, tokenAddress);

  console.log("[Arka] Mode:", mode, "Context:", context);
  console.log("[Arka] Paymaster URL:", paymasterUrl);

  // 1. Clear batch
  await sdk.clearUserOpsFromBatch();

  // 2. For ERC20: approve paymaster to spend tokens (add to batch first)
  if ((mode === "erc20" || mode === "multi-token") && tokenAddress && price) {
    // Fetch the ERC20 paymaster address for this token from Arka
    const paymasterListRes = await fetch(
      `https://rpc.etherspot.io/paymaster/getAllCommonERC20PaymasterAddress?apiKey=${arkaApiKey}&chainId=${chainId}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ params: [process.env.NEXT_PUBLIC_ENTRYPOINT_ADDRESS || "0x0000000071727De22E5E9d8BAf0edAc6f37da032"] }),
      }
    );

    let erc20PaymasterAddress: string | null = null;
    if (paymasterListRes.ok) {
      const pmData = await paymasterListRes.json();
      const list = pmData.message ? JSON.parse(pmData.message) : [];
      const match = list.find(
        (item: any) =>
          item.chainId === chainId &&
          item.gasToken.toLowerCase() === tokenAddress.toLowerCase()
      );
      if (match) erc20PaymasterAddress = match.paymasterAddress;
    }

    // Fallback: if Arka doesn't list our custom token, we can't do ERC20 via Arka
    // In that case, fall back to sponsor mode with a clear log
    if (!erc20PaymasterAddress) {
      console.warn("[Arka] Token not supported by Arka ERC20 paymaster. Falling back to sponsor mode.");
      context.mode = "sponsor";
    } else {
      // Approve the ERC20 paymaster to spend tokens
      const approveData = encodeErc20Approve(tokenAddress, erc20PaymasterAddress, price);
      await sdk.addUserOpsToBatch({ to: tokenAddress, data: approveData });
      console.log("[Arka] Added approve to batch for paymaster:", erc20PaymasterAddress);
    }
  }

  // 3. Add subscribe transaction to batch
  const subscribeData = encodeSubscribe(subscriptionManagerAddress, planId);
  await sdk.addUserOpsToBatch({ to: subscriptionManagerAddress, data: subscribeData });
  console.log("[Arka] Added subscribe to batch");

  // 4. Estimate with paymaster
  console.log("[Arka] Estimating UserOp...");
  const userOp = await sdk.estimate({
    paymasterDetails: {
      url: paymasterUrl,
      context,
    },
  });
  console.log("[Arka] Estimated UserOp:", userOp);

  // 5. Send to bundler
  console.log("[Arka] Sending UserOp to bundler...");
  const userOpHash = await sdk.send(userOp);
  console.log("[Arka] UserOpHash:", userOpHash);

  // 6. Poll for receipt
  console.log("[Arka] Waiting for receipt...");
  const receipt = await pollForReceipt(sdk, userOpHash);
  console.log("[Arka] Receipt:", receipt);

  const txHash = receipt || userOpHash;
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
  const paymasterUrl = getArkaPaymasterUrl();
  const context = buildPaymasterContext(mode);

  await sdk.clearUserOpsFromBatch();

  const data = encodeLifecycleAction(subscriptionManagerAddress, action, subscriptionId);
  await sdk.addUserOpsToBatch({ to: subscriptionManagerAddress, data });

  const userOp = await sdk.estimate({
    paymasterDetails: { url: paymasterUrl, context },
  });

  const userOpHash = await sdk.send(userOp);
  const receipt = await pollForReceipt(sdk, userOpHash);

  const txHash = receipt || userOpHash;
  const explorerUrl = `${APOTHEM_CHAIN.explorerUrl}tx/${txHash}`;

  return { txHash, explorerUrl, userOpHash };
}

// ── Helpers ──

async function pollForReceipt(sdk: ModularSdk, userOpHash: string, timeoutMs = 120000): Promise<string | null> {
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
  return null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function encodeSubscribe(subscriptionManagerAddress: string, planId: number): string {
  // subscribe(uint256 planId) selector = 0x9b3d47b4
  const selector = "0x9b3d47b4";
  const paddedPlanId = planId.toString(16).padStart(64, "0");
  return selector + paddedPlanId;
}

function encodeErc20Approve(tokenAddress: string, spender: string, amount: string): string {
  // approve(address spender, uint256 amount) selector = 0x095ea7b3
  const selector = "0x095ea7b3";
  const paddedSpender = spender.slice(2).padStart(64, "0");
  const approveAmount = (BigInt(amount) * BigInt(10)).toString(16).padStart(64, "0");
  return selector + paddedSpender + approveAmount;
}

function encodeLifecycleAction(
  subscriptionManagerAddress: string,
  action: "renew" | "pause" | "cancel",
  subscriptionId: number
): string {
  const selectors: Record<string, string> = {
    renew: "0x4f1b6eac",   // renew(uint256)
    pause: "0x02329a41",   // pause(uint256)
    cancel: "0x1e9a6950",  // cancel(uint256)
  };
  const selector = selectors[action];
  const paddedId = subscriptionId.toString(16).padStart(64, "0");
  return selector + paddedId;
}
