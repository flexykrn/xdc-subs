import { NextResponse } from "next/server";
import { createPublicClient, http } from "viem";
import { getPaymentState } from "@/lib/payment-state";

const SUB_TOKEN_ADDRESS = process.env.NEXT_PUBLIC_SUB_TOKEN_ADDRESS as `0x${string}`;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const paymentId = searchParams.get("paymentId");
  const userAddress = searchParams.get("userAddress");

  if (!paymentId || !userAddress) {
    return NextResponse.json(
      { error: "Missing paymentId or userAddress" },
      { status: 400 }
    );
  }

  const state = getPaymentState(paymentId);
  if (!state) {
    return NextResponse.json(
      { error: "Payment not found" },
      { status: 404 }
    );
  }

  // If minted, verify balance on-chain before saying it's ready
  if (state.status === "minted") {
    try {
      const rpcUrl = process.env.NEXT_PUBLIC_APOTHEM_RPC_URL || "https://erpc.apothem.network";
      const publicClient = createPublicClient({ transport: http(rpcUrl) });

      const balanceData = await publicClient.call({
        account: userAddress as `0x${string}`,
        to: SUB_TOKEN_ADDRESS,
        data: `0x70a08231000000000000000000000000${userAddress.slice(2)}` as `0x${string}`,
      });

      const balance = BigInt(balanceData.data || "0");
      const hasBalance = balance >= state.tokenAmount;

      return NextResponse.json({
        status: state.status,
        ready: hasBalance,
        txHash: state.txHash,
        balance: balance.toString(),
        expected: state.tokenAmount.toString(),
      });
    } catch {
      return NextResponse.json({
        status: state.status,
        ready: false,
        txHash: state.txHash,
        error: "Balance verification failed",
      });
    }
  }

  // For pending or failed states
  return NextResponse.json({
    status: state.status,
    ready: false,
    error: state.error,
    txHash: state.txHash,
  });
}
