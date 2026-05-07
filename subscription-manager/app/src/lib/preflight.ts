import { createPublicClient, http, parseAbi } from "viem";

const RPC_URL = process.env.NEXT_PUBLIC_APOTHEM_RPC_URL || "https://erpc.apothem.network";
const TOKEN_PAYMASTER = process.env.NEXT_PUBLIC_TOKEN_PAYMASTER_ADDRESS as `0x${string}`;
if (!TOKEN_PAYMASTER || TOKEN_PAYMASTER === "0x") {
  throw new Error("NEXT_PUBLIC_TOKEN_PAYMASTER_ADDRESS not set in environment");
}

const publicClient = createPublicClient({ transport: http(RPC_URL) });

const erc20Abi = parseAbi([
  "function balanceOf(address account) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function decimals() view returns (uint8)",
]);

const paymasterAbi = parseAbi([
  "function tokenRates(address token) view returns (uint256)",
  "function supportedTokens(address token) view returns (bool)",
]);

export interface PreflightCheck {
  tokenBalance: bigint;
  tokenAllowance: bigint;
  tokenDecimals: number;
  subscriptionCost: bigint;
  estimatedGasTokens: bigint;
  totalRequired: bigint;
  hasEnough: boolean;
  paymasterSupported: boolean;
}

/**
 * Pre-flight validation for ERC-20 paymaster mode
 * Checks if SA has enough tokens for subscription + gas
 */
export async function validatePreflight(
  saAddress: `0x${string}`,
  tokenAddress: `0x${string}`,
  subscriptionPriceWei: string,
  // Gas estimate in tXDC wei (e.g., 0.003 tXDC = 3000000000000000)
  estimatedGasXdcWei: bigint = 3000000000000000n,
): Promise<PreflightCheck> {
  // 1. Check if token is supported by paymaster
  const paymasterSupported = await publicClient.readContract({
    address: TOKEN_PAYMASTER,
    abi: paymasterAbi,
    functionName: "supportedTokens",
    args: [tokenAddress],
  });

  if (!paymasterSupported) {
    throw new Error(`Token ${tokenAddress} not supported by paymaster`);
  }

  // 2. Get token decimals
  const tokenDecimals = await publicClient.readContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: "decimals",
  }).catch(() => 18); // Default to 18 if call fails

  // 3. Get SA token balance
  const tokenBalance = await publicClient.readContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [saAddress],
  });

  // 4. Get SA allowance to paymaster
  const tokenAllowance = await publicClient.readContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: "allowance",
    args: [saAddress, TOKEN_PAYMASTER],
  });

  // 5. Get token rate (tokens per 1 tXDC wei)
  const tokenRate = await publicClient.readContract({
    address: TOKEN_PAYMASTER,
    abi: paymasterAbi,
    functionName: "tokenRates",
    args: [tokenAddress],
  });

  // 6. Calculate gas cost in tokens
  // gasCostTokens = gasXdcWei * tokenRate / 1e18
  const estimatedGasTokens = (estimatedGasXdcWei * tokenRate) / 10n**18n;

  // 7. Total required = subscription + gas (with 20% buffer for safety)
  const subscriptionCost = BigInt(subscriptionPriceWei);
  const totalRequired = subscriptionCost + (estimatedGasTokens * 120n / 100n);

  // 8. Check if SA has enough
  const hasEnough = tokenBalance >= totalRequired;

  return {
    tokenBalance,
    tokenAllowance,
    tokenDecimals,
    subscriptionCost,
    estimatedGasTokens,
    totalRequired,
    hasEnough,
    paymasterSupported,
  };
}

/**
 * Human-readable error message for insufficient balance
 */
export function formatPreflightError(check: PreflightCheck, tokenSymbol: string): string {
  const bal = Number(check.tokenBalance) / 10**check.tokenDecimals;
  const needed = Number(check.totalRequired) / 10**check.tokenDecimals;
  const sub = Number(check.subscriptionCost) / 10**check.tokenDecimals;
  const gas = Number(check.estimatedGasTokens) / 10**check.tokenDecimals;

  if (!check.paymasterSupported) {
    return `${tokenSymbol} is not supported for gas payments.`;
  }

  if (!check.hasEnough) {
    return `Insufficient ${tokenSymbol} balance. You have ${bal.toFixed(2)} ${tokenSymbol} but need ${needed.toFixed(2)} ${tokenSymbol} (Subscription: ${sub.toFixed(2)} + Gas: ~${gas.toFixed(4)}). Please buy more tokens.`;
  }

  if (check.tokenAllowance < check.totalRequired) {
    return `TokenPaymaster needs approval to spend ${tokenSymbol}. The system will auto-approve on first use.`;
  }

  return "";
}
