import { APOTHEM_CHAIN } from "@/config/chains";
import {
  CHAIN_NAMESPACES,
  WEB3AUTH_NETWORK,
  WALLET_ADAPTERS,
  type IProvider,
} from "@web3auth/base";
import { EthereumPrivateKeyProvider } from "@web3auth/ethereum-provider";
import { Web3Auth } from "@web3auth/modal";

type ProviderWithRequest = IProvider & {
  request: (args: { method: string; params?: unknown[] | object }) => Promise<unknown>;
};

let web3authInstance: Web3Auth | null = null;
let initPromise: Promise<Web3Auth> | null = null;

function makeChainConfig() {
  return {
    chainNamespace: CHAIN_NAMESPACES.EIP155,
    chainId: "0x33",
    rpcTarget: APOTHEM_CHAIN.rpcUrl,
    displayName: APOTHEM_CHAIN.chainName,
    blockExplorerUrl: APOTHEM_CHAIN.explorerUrl,
    ticker: APOTHEM_CHAIN.nativeCurrency.symbol,
    tickerName: APOTHEM_CHAIN.nativeCurrency.name,
    decimals: 18,
  };
}

export async function getWeb3Auth(): Promise<Web3Auth> {
  if (web3authInstance) {
    return web3authInstance;
  }

  // Prevent double initialization during React Strict Mode
  if (initPromise) {
    return initPromise;
  }

  const clientId = process.env.NEXT_PUBLIC_WEB3AUTH_CLIENT_ID;
  if (!clientId) {
    throw new Error("Missing NEXT_PUBLIC_WEB3AUTH_CLIENT_ID");
  }

  const chainConfig = makeChainConfig();

  const privateKeyProvider = new EthereumPrivateKeyProvider({
    config: { chainConfig },
  });

  const web3auth = new Web3Auth({
    clientId,
    web3AuthNetwork: WEB3AUTH_NETWORK.SAPPHIRE_DEVNET,
    privateKeyProvider,
    chainConfig,
  } as never);

  initPromise = (async () => {
    const maxRetries = 2;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        await web3auth.initModal({
          modalConfig: {
            [WALLET_ADAPTERS.AUTH]: {
              label: "auth",
              showOnModal: true,
            },
          },
        });
        web3authInstance = web3auth;
        return web3auth;
      } catch (e) {
        const errorMsg = (e as Error)?.message || "";
        console.warn(`[Web3Auth] initModal attempt ${attempt + 1} failed:`, errorMsg);

        if (errorMsg.includes("already initialized")) {
          web3authInstance = web3auth;
          return web3auth;
        }

        if (attempt < maxRetries - 1) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        } else {
          throw new Error(
            `Web3Auth initialization failed after ${maxRetries} attempts: ${errorMsg}. ` +
            `Please check your internet connection and verify the Web3Auth Client ID is valid for SAPPHIRE_DEVNET.`
          );
        }
      }
    }
    return web3auth;
  })();

  return initPromise;
}

export async function connectWeb3Auth(): Promise<IProvider> {
  const web3auth = await getWeb3Auth();
  const provider = await web3auth.connect();

  if (!provider) {
    throw new Error("Web3Auth connect failed");
  }

  return provider;
}

export async function disconnectWeb3Auth(): Promise<void> {
  const web3auth = await getWeb3Auth();
  await web3auth.logout();
}

export async function getProviderPrivateKey(provider: IProvider): Promise<string> {
  const requestProvider = provider as ProviderWithRequest;

  const candidates = ["eth_private_key", "private_key"];
  for (const method of candidates) {
    try {
      const key = await requestProvider.request({ method });
      if (typeof key === "string" && key.length > 0) {
        return key.startsWith("0x") ? key : `0x${key}`;
      }
    } catch {
      // Try next known method name.
    }
  }

  throw new Error(
    "Unable to read private key. " +
    "Please use SOCIAL LOGIN (Google/Twitter) instead of external wallets."
  );
}

export async function getProviderAccounts(provider: IProvider): Promise<string[]> {
  const requestProvider = provider as ProviderWithRequest;
  try {
    const accounts = await requestProvider.request({ method: "eth_accounts" });
    if (Array.isArray(accounts)) {
      return accounts.filter((value): value is string => typeof value === "string");
    }
  } catch {
    // Return empty list if account method is unavailable.
  }

  return [];
}
