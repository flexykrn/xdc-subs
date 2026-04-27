import { NextResponse } from "next/server";
import { createWalletClient, createPublicClient, http, parseEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const rpcUrl = process.env.NEXT_PUBLIC_APOTHEM_RPC_URL || "https://erpc.apothem.network";
const deployerKey = process.env.FAUCET_PRIVATE_KEY || "";

const viemChain = {
  id: 51,
  name: "XDC Apothem",
  nativeCurrency: { name: "XDC", symbol: "XDC", decimals: 18 },
  rpcUrls: { default: { http: [rpcUrl] }, public: { http: [rpcUrl] } },
  testnet: true,
} as const;

/**
 * Gas Station — Auto-fund user wallets with a tiny amount of tXDC
 * so they can execute subscription transactions.
 * The deployer pays for this gas sponsorship.
 * On mainnet, Account Abstraction + Paymaster makes this unnecessary.
 */
export async function POST(request: Request) {
  try {
    if (!deployerKey) {
      return NextResponse.json(
        { success: false, error: "Gas station not configured — missing deployer key" },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { to }: { to?: string } = body;

    if (!to || !to.startsWith("0x") || to.length !== 42) {
      return NextResponse.json(
        { success: false, error: "Invalid recipient address" },
        { status: 400 }
      );
    }

    const deployerAccount = privateKeyToAccount(deployerKey as `0x${string}`);

    const publicClient = createPublicClient({
      chain: viemChain,
      transport: http(rpcUrl),
    });

    // Check deployer balance first
    const deployerBalance = await publicClient.getBalance({ address: deployerAccount.address });
    const minDeployerBalance = parseEther("0.1");
    if (deployerBalance < minDeployerBalance) {
      return NextResponse.json(
        { success: false, error: "Deployer wallet low on tXDC. Please fund it." },
        { status: 503 }
      );
    }

    // Check if recipient already has gas
    const recipientBalance = await publicClient.getBalance({ address: to as `0x${string}` });
    if (recipientBalance >= parseEther("0.01")) {
      return NextResponse.json(
        { success: true, funded: false, reason: "Recipient already has sufficient gas" }
      );
    }

    // Send 0.01 tXDC for gas
    const walletClient = createWalletClient({
      account: deployerAccount,
      chain: viemChain,
      transport: http(rpcUrl),
    });

    const txHash = await walletClient.sendTransaction({
      to: to as `0x${string}`,
      value: parseEther("0.01"),
    });

    // Wait for receipt
    let receipt = null;
    for (let i = 0; i < 20; i++) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      try {
        receipt = await publicClient.getTransactionReceipt({ hash: txHash });
        if (receipt) break;
      } catch {
        // not yet mined
      }
    }

    if (!receipt || receipt.status !== "success") {
      return NextResponse.json(
        { success: false, error: "Gas funding transaction failed" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      funded: true,
      txHash,
      amount: "0.01",
      recipient: to,
    });
  } catch (error) {
    console.error("[GasStation] Error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
