import { PrimeSdk, EtherspotBundler } from "@etherspot/prime-sdk";
import { APOTHEM_CHAIN } from "@/config/chains";

const chainId = APOTHEM_CHAIN.chainIdDecimal;

export type GasMode = "sponsor" | "erc20" | "multi-token";

export async function getEtherspotPrime(privateKeyHex: string): Promise<PrimeSdk> {
  if (!privateKeyHex || !privateKeyHex.startsWith("0x")) {
    throw new Error("Invalid private key format. Expected 0x-prefixed hex string.");
  }

  const bundlerUrl = process.env.NEXT_PUBLIC_BUNDLER_URL;
  if (!bundlerUrl) {
    throw new Error("Missing env var: NEXT_PUBLIC_BUNDLER_URL. Check .env.local");
  }
  const url = new URL(bundlerUrl);
  const apiKey = url.searchParams.get("api-key") || undefined;
  const baseUrl = `${url.protocol}//${url.host}${url.pathname}`;

  const entryPointAddress = process.env.NEXT_PUBLIC_ENTRYPOINT_ADDRESS;
  if (!entryPointAddress) {
    throw new Error("Missing env var: NEXT_PUBLIC_ENTRYPOINT_ADDRESS. Check .env.local");
  }

  const walletFactoryAddress = process.env.NEXT_PUBLIC_SIMPLE_ACCOUNT_FACTORY_ADDRESS;
  if (!walletFactoryAddress) {
    throw new Error("Missing env var: NEXT_PUBLIC_SIMPLE_ACCOUNT_FACTORY_ADDRESS. Check .env.local");
  }

  const primeSdk = new PrimeSdk(privateKeyHex, {
    chainId,
    entryPointAddress,
    walletFactoryAddress,
    bundlerProvider: new EtherspotBundler(chainId, apiKey, baseUrl),
  });
  return primeSdk;
}

export async function getSmartAccountAddress(primeSdk: PrimeSdk): Promise<string> {
  return primeSdk.getCounterFactualAddress();
}
