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
    const { to, amount }: { to?: string; amount?: string } = body;

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

    // Determine amount to send
    let sendAmount: bigint;
    if (amount && amount !== "0") {
      // Exact amount requested (in wei string)
      sendAmount = BigInt(amount);
    } else {
      // Default: check if recipient needs any gas
      const recipientBalance = await publicClient.getBalance({ address: to as `0x${string}` });
      if (recipientBalance > 0) {
        return NextResponse.json(
          { success: true, funded: false, reason: "Recipient already has gas" }
        );
      }
      sendAmount = parseEther("0.05"); // default fallback
    }

    // Cap at reasonable max to prevent draining
    const maxAmount = parseEther("0.1");
    if (sendAmount > maxAmount) {
      sendAmount = maxAmount;
    }

    // Send tXDC
    const walletClient = createWalletClient({
      account: deployerAccount,
      chain: viemChain,
      transport: http(rpcUrl),
    });

    const txHash = await walletClient.sendTransaction({
      to: to as `0x${string}`,
      value: sendAmount,
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
      amount: (Number(sendAmount) / 1e18).toString(),
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
