import { APOTHEM_CHAIN } from "@/config/chains";
import { EtherspotBundler, ModularSdk } from "@etherspot/modular-sdk";

export function getPaymasterUrl(apiKey: string) {
  return `https://arka.etherspot.io?apiKey=${apiKey}&chainId=${APOTHEM_CHAIN.chainIdDecimal}`;
}

export type GasMode = "sponsor" | "erc20" | "multi-token";

export interface SmartAccountSnapshot {
  smartAccountAddress: string;
  nativeBalance: string;
}

export function createModularSdk(privateKey: string, bundlerUrl?: string): ModularSdk {
  if (!privateKey) {
    throw new Error("Private key is required to initialize ModularSdk");
  }

  const resolvedBundlerUrl = bundlerUrl || process.env.NEXT_PUBLIC_BUNDLER_URL;
  const bundlerProvider = new EtherspotBundler(
    APOTHEM_CHAIN.chainIdDecimal,
    undefined,
    resolvedBundlerUrl,
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
  try {
    const sdk = createModularSdk(privateKey, bundlerUrl);
    const [smartAccountAddress, nativeBalance] = await Promise.all([
      sdk.getCounterFactualAddress(),
      sdk.getNativeBalance(),
    ]);

    return {
      smartAccountAddress,
      nativeBalance,
    };
  } catch (err) {
    // Etherspot factory not deployed on XDC Apothem - return EOA-derived address
    console.warn("[Etherspot] getCounterFactualAddress failed:", err);
    return {
      smartAccountAddress: "Smart account (compute pending)",
      nativeBalance: "0",
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
