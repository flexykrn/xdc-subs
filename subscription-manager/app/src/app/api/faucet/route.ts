import { NextResponse } from "next/server";
import { createWalletClient, createPublicClient, http } from "viem";
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

const erc20MintAbi = [
  {
    name: "faucetMint",
    type: "function",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
] as const;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { tokenAddress, to, amount } = body;

    if (!faucetPrivateKey) {
      console.error("[Faucet] Missing FAUCET_PRIVATE_KEY env var");
      return NextResponse.json({ success: false, error: "Faucet not configured — missing private key" }, { status: 500 });
    }
    if (!tokenAddress || !to || !amount) {
      return NextResponse.json({ success: false, error: "Missing parameters — need tokenAddress, to, amount" }, { status: 400 });
    }

    const account = privateKeyToAccount(faucetPrivateKey as `0x${string}`);
    console.log("[Faucet] Minting to", to, "from", account.address);

    const walletClient = createWalletClient({ account, chain: viemChain, transport: http(rpcUrl) });

    const txHash = await walletClient.writeContract({
      address: tokenAddress as `0x${string}`,
      abi: erc20MintAbi,
      functionName: "faucetMint",
      args: [to as `0x${string}`, BigInt(amount)],
    });

    console.log("[Faucet] Success — tx:", txHash);
    return NextResponse.json({ success: true, txHash });
  } catch (error) {
    console.error("[Faucet] Error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error", details: String(error) },
      { status: 500 }
    );
  }
}
