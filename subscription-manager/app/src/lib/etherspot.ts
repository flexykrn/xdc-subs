import { PrimeSdk, EtherspotBundler } from "@etherspot/prime-sdk";
import { APOTHEM_CHAIN } from "@/config/chains";

const chainId = APOTHEM_CHAIN.chainIdDecimal;
const arkaApiKey = process.env.NEXT_PUBLIC_ARKA_API_KEY || "etherspot_AA2QUX5f6tqxLEA8hC7XQu";
const arkaUrl = "https://rpc.etherspot.io/paymaster";

function getArkaUrl(): string {
  return `${arkaUrl}?apiKey=${arkaApiKey}&chainId=${chainId}&useVp=true`;
}

export type GasMode = "sponsor" | "erc20" | "multi-token";

export async function getEtherspotPrime(walletProviderLike: any): Promise<PrimeSdk> {
  const bundlerUrl = process.env.NEXT_PUBLIC_BUNDLER_URL || "https://testnet-rpc.etherspot.io/v1/51?api-key=etherspot_AA2QUX5f6tqxLEA8hC7XQu";
  const url = new URL(bundlerUrl);
  const apiKey = url.searchParams.get("api-key") || undefined;
  const baseUrl = `${url.protocol}//${url.host}${url.pathname}`;

  // PrimeSdk accepts: hex private key string, { privateKey }, or WalletProvider
  // Web3Auth provider has a privateKey — extract it and pass directly
  let privateKey: string | undefined;

  if (typeof walletProviderLike === "string" && walletProviderLike.startsWith("0x")) {
    privateKey = walletProviderLike;
  } else if (walletProviderLike && typeof walletProviderLike === "object") {
    // Try to extract private key from Web3Auth provider
    const pk = walletProviderLike.privateKey || walletProviderLike._privKey;
    if (typeof pk === "string" && pk.startsWith("0x")) {
      privateKey = pk;
    }
    // Also try requesting eth_private_key
    if (!privateKey && typeof walletProviderLike.request === "function") {
      try {
        const key = await walletProviderLike.request({ method: "eth_private_key" });
        if (typeof key === "string" && key.startsWith("0x")) {
          privateKey = key;
        }
      } catch { /* ignore */ }
    }
  }

  if (!privateKey) {
    throw new Error("Unable to extract private key from wallet provider. Use email/social login.");
  }

  const primeSdk = new PrimeSdk(privateKey, {
    chainId,
    entryPointAddress: process.env.NEXT_PUBLIC_ENTRYPOINT_ADDRESS || "0x0000000071727De22E5E9d8BAf0edAc6f37da032",
    walletFactoryAddress: process.env.NEXT_PUBLIC_SIMPLE_ACCOUNT_FACTORY_ADDRESS || "0x71D0Fe73d7f05A8D7Ce0F7c68Df71c4A3F0d80b0",
    bundlerProvider: new EtherspotBundler(chainId, apiKey, baseUrl),
  });
  return primeSdk;
}

export async function getSmartAccountAddress(primeSdk: PrimeSdk): Promise<string> {
  return primeSdk.getCounterFactualAddress();
}
