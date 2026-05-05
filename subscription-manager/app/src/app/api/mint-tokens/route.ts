import { NextResponse } from "next/server";
import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");

const MINTER_KEY = process.env.MINTER_PRIVATE_KEY as `0x${string}`;
if (!MINTER_KEY || MINTER_KEY === "0x") {
  throw new Error("MINTER_PRIVATE_KEY not set in environment");
}
const minterAccount = privateKeyToAccount(MINTER_KEY);

const SUB_TOKEN_ADDRESS = process.env.NEXT_PUBLIC_SUB_TOKEN_ADDRESS as `0x${string}`;
if (!SUB_TOKEN_ADDRESS || SUB_TOKEN_ADDRESS === "0x") {
  throw new Error("NEXT_PUBLIC_SUB_TOKEN_ADDRESS not set in environment");
}

const xdcTestnet = {
  id: 51,
  name: "XDC Apothem",
  nativeCurrency: { name: "XDC", symbol: "XDC", decimals: 18 },
  rpcUrls: { default: { http: [process.env.NEXT_PUBLIC_APOTHEM_RPC_URL || "https://erpc.apothem.network"] }, public: { http: [process.env.NEXT_PUBLIC_APOTHEM_RPC_URL || "https://erpc.apothem.network"] } },
} as const;

const mintAbi = [{
  name: "mintForPayment",
  type: "function",
  inputs: [
    { name: "to", type: "address" },
    { name: "amount", type: "uint256" },
    { name: "paymentId", type: "string" },
  ],
  outputs: [],
  stateMutability: "nonpayable",
}] as const;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { paymentId, userAddress } = body;

    if (!paymentId || !userAddress) {
      return NextResponse.json({ error: "Missing paymentId or userAddress" }, { status: 400 });
    }

    const paymentIntent = await stripe.paymentIntents.retrieve(paymentId);
    if (paymentIntent.status !== "succeeded") {
      return NextResponse.json({ error: "Payment not succeeded" }, { status: 400 });
    }

    const tokensToMint = Math.floor(paymentIntent.amount / 100); // e.g. ₹5 = 500 paise → 5 tokens
    const tokenAmount = BigInt(tokensToMint) * 10n ** 18n;

    const walletClient = createWalletClient({
      account: minterAccount,
      chain: xdcTestnet,
      transport: http(process.env.NEXT_PUBLIC_APOTHEM_RPC_URL || "https://erpc.apothem.network"),
    });

    let txHash: string | null = null;
    let attempts = 0;

    while (attempts < 3) {
      try {
        txHash = await walletClient.writeContract({
          address: SUB_TOKEN_ADDRESS,
          abi: mintAbi,
          functionName: "mintForPayment",
          args: [userAddress as `0x${string}`, tokenAmount, paymentId],
        });
        break;
      } catch (e) {
        attempts++;
        if (attempts === 3) throw e;
        await new Promise((r) => setTimeout(r, 2000 * attempts));
      }
    }

    return NextResponse.json({
      success: true,
      paymentId,
      txHash,
      minted: tokenAmount.toString(),
      userAddress,
    });

  } catch (error) {
    console.error("[Mint] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Mint failed" },
      { status: 500 }
    );
  }
}
