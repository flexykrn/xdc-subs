import { APOTHEM_CHAIN } from "@/config/chains";
import { EtherspotBundler, ModularSdk } from "@etherspot/modular-sdk";
import { privateKeyToAccount } from "viem/accounts";

export function getPaymasterUrl(apiKey: string) {
  return `https://arka.etherspot.io?apiKey=${apiKey}&chainId=${APOTHEM_CHAIN.chainIdDecimal}`;
}

export type GasMode = "sponsor" | "erc20" | "multi-token";

export interface SmartAccountSnapshot {
  smartAccountAddress: string;
  nativeBalance: string;
  eoaAddress: string;
}

export function createModularSdk(privateKey: string, bundlerUrl?: string): ModularSdk {
  if (!privateKey) {
    throw new Error("Private key is required to initialize ModularSdk");
  }

  const resolvedBundlerUrl = bundlerUrl || process.env.NEXT_PUBLIC_BUNDLER_URL;
  
  // Extract apiKey from URL query string if present (Etherspot format)
  let apiKey: string | undefined = undefined;
  let baseUrl = resolvedBundlerUrl;
  
  if (resolvedBundlerUrl) {
    try {
      const url = new URL(resolvedBundlerUrl);
      apiKey = url.searchParams.get("api-key") || undefined;
      // Reconstruct base URL without query string
      baseUrl = `${url.protocol}//${url.host}${url.pathname}`;
    } catch {
      // URL parsing failed, use as-is
      baseUrl = resolvedBundlerUrl;
    }
  }

  const bundlerProvider = new EtherspotBundler(
    APOTHEM_CHAIN.chainIdDecimal,
    apiKey,
    baseUrl,
  );

  return new ModularSdk(privateKey, {
    chainId: APOTHEM_CHAIN.chainIdDecimal,
    bundlerProvider,
  });
}

export async function getSmartAccountSnapshot(
  privateKey: string,
  bundlerUrl?: string,
): Promise<SmartAccountSnapshot> {
  // Always compute EOA address
  const eoaAccount = privateKeyToAccount(privateKey as `0x${string}`);
  const eoaAddress = eoaAccount.address;

  try {
    const sdk = createModularSdk(privateKey, bundlerUrl);
    const [smartAccountAddress, nativeBalance] = await Promise.all([
      sdk.getCounterFactualAddress(),
      sdk.getNativeBalance(),
    ]);

    return {
      smartAccountAddress,
      nativeBalance,
      eoaAddress,
    };
  } catch (err) {
    // Etherspot factory not deployed on XDC Apothem - fallback to EOA
    console.warn("[Etherspot] getCounterFactualAddress failed, using EOA:", err);
    return {
      smartAccountAddress: eoaAddress,
      nativeBalance: "0",
      eoaAddress,
    };
  }
}

export function buildPaymasterContext(mode: GasMode, tokenAddress?: string) {
  if (mode === "sponsor") {
    return { mode: "sponsor" };
  }

  if (!tokenAddress) {
    throw new Error("tokenAddress is required for ERC20 or multi-token mode");
  }

  return {
    mode,
    tokenAddress,
  };
}
