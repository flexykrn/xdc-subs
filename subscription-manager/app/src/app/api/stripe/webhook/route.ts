import { NextResponse } from "next/server";
import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import Stripe from "stripe";
import { setPaymentState, updatePaymentState } from "@/lib/payment-state";
import { getCounterFactualAddress } from "@/lib/aa-core";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "";

const MINTER_KEY = process.env.MINTER_PRIVATE_KEY as `0x${string}`;
if (!MINTER_KEY || MINTER_KEY === "0x") {
  console.warn("[Webhook] MINTER_PRIVATE_KEY not set");
}

const SUB_TOKEN_ADDRESS = process.env.NEXT_PUBLIC_SUB_TOKEN_ADDRESS as `0x${string}`;
if (!SUB_TOKEN_ADDRESS || SUB_TOKEN_ADDRESS === "0x") {
  console.warn("[Webhook] NEXT_PUBLIC_SUB_TOKEN_ADDRESS not set");
}

const xdcTestnet = {
  id: 51,
  name: "XDC Apothem",
  nativeCurrency: { name: "XDC", symbol: "XDC", decimals: 18 },
  rpcUrls: {
    default: { http: [process.env.NEXT_PUBLIC_APOTHEM_RPC_URL || "https://erpc.apothem.network"] },
    public: { http: [process.env.NEXT_PUBLIC_APOTHEM_RPC_URL || "https://erpc.apothem.network"] },
  },
} as const;

const mintAbi = [
  {
    name: "mintForPayment",
    type: "function",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "paymentId", type: "string" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
] as const;

export async function POST(request: Request) {
  try {
    const signature = request.headers.get("stripe-signature");
    if (!signature) {
      return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 });
    }

    if (!WEBHOOK_SECRET) {
      return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
    }

    const body = await request.text();
    let event;

    try {
      event = stripe.webhooks.constructEvent(body, signature, WEBHOOK_SECRET);
    } catch {
      return NextResponse.json({ error: "Webhook signature verification failed" }, { status: 400 });
    }

    if (event.type === "payment_intent.succeeded") {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      const { userAddress } = paymentIntent.metadata;

      if (!userAddress) {
        return NextResponse.json({ error: "Missing userAddress" }, { status: 400 });
      }

      // Compute Smart Account address for this EOA so tokens go directly there
      let smartAccountAddress: `0x${string}` = userAddress as `0x${string}`;
      try {
        smartAccountAddress = await getCounterFactualAddress(userAddress as `0x${string}`);
        console.log(`[Webhook] Computed Smart Account: ${smartAccountAddress} for EOA: ${userAddress}`);
      } catch (err) {
        console.warn(`[Webhook] Could not compute Smart Account, falling back to EOA:`, err);
      }

      const tokenAmount = BigInt(Math.floor(paymentIntent.amount / 100)) * 10n ** 18n;

      setPaymentState(paymentIntent.id, {
        status: "pending",
        userAddress,
        tokenAmount,
        timestamp: Date.now(),
      });

      // Mint in background (to Smart Account, not EOA)
      mintTokensAsync(paymentIntent.id, smartAccountAddress, paymentIntent.amount, userAddress).catch((err) => {
        console.error(`[Webhook] Mint failed for ${paymentIntent.id}:`, err);
        setPaymentState(paymentIntent.id, {
          status: "failed",
          userAddress,
          tokenAmount,
          timestamp: Date.now(),
          error: "Token minting failed",
        });
      });

      return NextResponse.json({ success: true });
    }

    if (event.type === "payment_intent.payment_failed") {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      setPaymentState(paymentIntent.id, {
        status: "failed",
        userAddress: paymentIntent.metadata?.userAddress || "",
        tokenAmount: 0n,
        timestamp: Date.now(),
        error: "Payment failed",
      });

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[Webhook] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}

async function mintTokensAsync(
  paymentId: string,
  mintTo: `0x${string}`,
  amountPaise: number,
  originalEoa: string = "",
) {
  let attempts = 0;
  const maxAttempts = 3;

  while (attempts < maxAttempts) {
    try {
      if (!MINTER_KEY || MINTER_KEY === "0x") {
        throw new Error("MINTER_PRIVATE_KEY not configured");
      }

      const minterAccount = privateKeyToAccount(MINTER_KEY);
      const walletClient = createWalletClient({
        account: minterAccount,
        chain: xdcTestnet,
        transport: http(process.env.NEXT_PUBLIC_APOTHEM_RPC_URL || "https://erpc.apothem.network"),
      });

      const tokenAmount = BigInt(Math.floor(amountPaise / 100)) * 10n ** 18n;

      const txHash = await walletClient.writeContract({
        address: SUB_TOKEN_ADDRESS,
        abi: mintAbi,
        functionName: "mintForPayment",
        args: [mintTo, tokenAmount, paymentId],
      });

      console.log(`[Mint] Success: ${paymentId} minted to ${mintTo} (EOA: ${originalEoa}) → ${txHash}`);

      updatePaymentState(paymentId, {
        status: "minted",
        txHash,
      });

      return txHash;
    } catch (error) {
      attempts++;
      console.error(`[Mint] Attempt ${attempts}/${maxAttempts} failed:`, error);

      if (attempts < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 2000 * attempts));
      } else {
        throw new Error("Token minting failed after 3 attempts");
      }
    }
  }
}
