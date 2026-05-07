import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, http, parseAbi } from "viem";

const RPC_URL = process.env.NEXT_PUBLIC_APOTHEM_RPC_URL || "https://erpc.apothem.network";

const publicClient = createPublicClient({ transport: http(RPC_URL) });

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const paymasterAddress = searchParams.get("paymaster") as `0x${string}`;
    
    if (!paymasterAddress) {
      return NextResponse.json({ error: "Missing paymaster address" }, { status: 400 });
    }

    const owner = await publicClient.readContract({
      address: paymasterAddress,
      abi: parseAbi(["function owner() view returns (address)"]),
      functionName: "owner",
    });

    const deposit = await publicClient.readContract({
      address: "0x0000000071727De22E5E9d8BAf0edAc6f37da032",
      abi: parseAbi(["function getDepositInfo(address account) view returns (uint112 deposit, bool staked, uint112 stake, uint32 unstakeDelaySec, uint48 withdrawTime)"]),
      functionName: "getDepositInfo",
      args: [paymasterAddress],
    });

    return NextResponse.json({
      paymaster: paymasterAddress,
      owner,
      deposit: deposit[0].toString(),
      staked: deposit[1],
    });

  } catch (err) {
    console.error("[Paymaster Debug] Error:", err);
    const msg = err instanceof Error ? err.message : "Debug failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
