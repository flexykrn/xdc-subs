import { PrimeSdk, EtherspotBundler } from "@etherspot/prime-sdk";
import { APOTHEM_CHAIN } from "@/config/chains";

const chainId = APOTHEM_CHAIN.chainIdDecimal;

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

export async function getEtherspotPrime(privateKeyHex: string): Promise<PrimeSdk> {
  if (!privateKeyHex || !privateKeyHex.startsWith("0x")) {
    throw new Error("Invalid private key format. Expected 0x-prefixed hex string.");
  }

  const bundlerUrl = requireEnv("NEXT_PUBLIC_BUNDLER_URL");
  const url = new URL(bundlerUrl);
  const apiKey = url.searchParams.get("api-key") || undefined;
  const baseUrl = `${url.protocol}//${url.host}${url.pathname}`;

  const entryPointAddress = requireEnv("NEXT_PUBLIC_ENTRYPOINT_ADDRESS");
  const walletFactoryAddress = requireEnv("NEXT_PUBLIC_SIMPLE_ACCOUNT_FACTORY_ADDRESS");

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
