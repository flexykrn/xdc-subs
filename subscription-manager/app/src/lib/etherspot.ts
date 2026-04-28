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

  // Wrap Web3Auth provider to match Etherspot's EthereumProvider interface
  const wrappedProvider = {
    request: async (args: { method: string; params?: unknown[] | object }) => {
      return web3Provider.request(args);
    },
    sendAsync: (args: any, callback: any) => {
      web3Provider.request(args).then((result: any) => callback(null, { jsonrpc: "2.0", id: args.id, result })).catch((err: any) => callback(err));
    },
    on: (event: string, callback: any) => {
      if (web3Provider.on) web3Provider.on(event, callback);
    },
    once: (event: string, callback: any) => {
      if (web3Provider.once) web3Provider.once(event, callback);
    },
    removeListener: (event: string, callback: any) => {
      if (web3Provider.removeListener) web3Provider.removeListener(event, callback);
    },
    off: (event: string, callback: any) => {
      if (web3Provider.off) web3Provider.off(event, callback);
    },
    disconnect: async () => {
      if (web3Provider.disconnect) await web3Provider.disconnect();
    },
    accounts: [],
    chainId: chainId,
    isWalletConnect: false,
  };

  const primeSdk = new PrimeSdk(wrappedProvider as any, {
    chainId,
    bundlerProvider: new EtherspotBundler(chainId, apiKey, baseUrl),
  });
  return primeSdk;
}

export async function getSmartAccountAddress(primeSdk: PrimeSdk): Promise<string> {
  return primeSdk.getCounterFactualAddress();
}
