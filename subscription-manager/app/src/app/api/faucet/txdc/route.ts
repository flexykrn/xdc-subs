import { NextResponse } from "next/server";
import { createWalletClient, createPublicClient, http, parseEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const rpcUrl = process.env.NEXT_PUBLIC_APOTHEM_RPC_URL || "https://erpc.apothem.network";
const faucetPrivateKey = process.env.FAUCET_PRIVATE_KEY || process.env.NEXT_PUBLIC_FAUCET_PRIVATE_KEY || "";

const viemChain = {
  id: 51,
  name: "XDC Apothem",
  nativeCurrency: { name: "XDC", symbol: "XDC", decimals: 18 },
  rpcUrls: { default: { http: [rpcUrl] }, public: { http: [rpcUrl] } },
  testnet: true,
} as const;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { to } = body;

    if (!faucetPrivateKey) {
      console.error("[Faucet tXDC] Missing FAUCET_PRIVATE_KEY env var");
      return NextResponse.json({ success: false, error: "Faucet not configured — missing private key" }, { status: 500 });
    }
    if (!to) {
      return NextResponse.json({ success: false, error: "Missing 'to' address" }, { status: 400 });
    }

    const account = privateKeyToAccount(faucetPrivateKey as `0x${string}`);
    console.log("[Faucet tXDC] Sending 1 tXDC to", to, "from", account.address);

    const walletClient = createWalletClient({ account, chain: viemChain, transport: http(rpcUrl) });
    const publicClient = createPublicClient({ chain: viemChain, transport: http(rpcUrl) });

    // Check deployer balance first
    const deployerBalance = await publicClient.getBalance({ address: account.address });
    if (deployerBalance < parseEther("1")) {
      return NextResponse.json({ 
        success: false, 
        error: "Faucet dry — deployer has insufficient tXDC. Please use https://faucet.apothem.network/" 
      }, { status: 500 });
    }

    const txHash = await walletClient.sendTransaction({
      to: to as `0x${string}`,
      value: parseEther("1"),
    });

    console.log("[Faucet tXDC] Success — tx:", txHash);
    return NextResponse.json({ success: true, txHash });
  } catch (error) {
    console.error("[Faucet tXDC] Error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error", details: String(error) },
      { status: 500 }
    );
  }
}
