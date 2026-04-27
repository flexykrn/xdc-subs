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

  // Use our deployed EntryPoint and SimpleAccountFactory on XDC Apothem
  // instead of Etherspot's defaults which aren't deployed on this chain
  const entryPointAddress = process.env.NEXT_PUBLIC_ENTRYPOINT_ADDRESS || "0x0000000071727De22E5E9d8BAf0edAc6f37da032";
  const walletFactoryAddress = process.env.NEXT_PUBLIC_SIMPLE_ACCOUNT_FACTORY_ADDRESS || "0x91E60e0613810449d098b0b5Ec8b51A0FE8c8985";

  return new ModularSdk(privateKey, {
    chainId: APOTHEM_CHAIN.chainIdDecimal,
    bundlerProvider,
    entryPointAddress,
    walletFactoryAddress,
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
    // Smart account factory not deployed or ABI mismatch - fallback to EOA
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
