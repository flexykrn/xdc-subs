import { PrimeSdk, EtherspotBundler } from "@etherspot/prime-sdk";
import { APOTHEM_CHAIN } from "@/config/chains";

const chainId = APOTHEM_CHAIN.chainIdDecimal;
const arkaApiKey = process.env.NEXT_PUBLIC_ARKA_API_KEY || "etherspot_AA2QUX5f6tqxLEA8hC7XQu";
const arkaUrl = "https://rpc.etherspot.io/paymaster";

function getArkaUrl(): string {
  return `${arkaUrl}?apiKey=${arkaApiKey}&chainId=${chainId}&useVp=true`;
}

export type GasMode = "sponsor" | "erc20" | "multi-token";

export async function getEtherspotPrime(web3Provider: any): Promise<PrimeSdk> {
  const bundlerUrl = process.env.NEXT_PUBLIC_BUNDLER_URL || "https://testnet-rpc.etherspot.io/v1/51?api-key=etherspot_AA2QUX5f6tqxLEA8hC7XQu";
  const url = new URL(bundlerUrl);
  const apiKey = url.searchParams.get("api-key") || undefined;
  const baseUrl = `${url.protocol}//${url.host}${url.pathname}`;

  const primeSdk = new PrimeSdk(web3Provider, {
    chainId,
    bundlerProvider: new EtherspotBundler(chainId, apiKey, baseUrl),
  });
  return primeSdk;
}

export async function getSmartAccountAddress(primeSdk: PrimeSdk): Promise<string> {
  return primeSdk.getCounterFactualAddress();
}
