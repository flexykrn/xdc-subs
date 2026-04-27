import { NextResponse } from "next/server";
import { createWalletClient, createPublicClient, http, parseEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const rpcUrl = process.env.NEXT_PUBLIC_APOTHEM_RPC_URL || "https://erpc.apothem.network";
const deployerKey = process.env.FAUCET_PRIVATE_KEY || "";
const paymasterAddress = (process.env.NEXT_PUBLIC_PAYMASTER_ADDRESS || "") as `0x${string}`;

const viemChain = {
  id: 51,
  name: "XDC Apothem",
  nativeCurrency: { name: "XDC", symbol: "XDC", decimals: 18 },
  rpcUrls: { default: { http: [rpcUrl] }, public: { http: [rpcUrl] } },
  testnet: true,
} as const;

const paymasterAbi = [
  {
    name: "swap",
    type: "function",
    inputs: [
      { name: "token", type: "address" },
      { name: "xdcAmount", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    name: "previewSwap",
    type: "function",
    inputs: [
      { name: "token", type: "address" },
      { name: "xdcAmount", type: "uint256" },
    ],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
  {
    name: "supportedTokens",
    type: "function",
    inputs: [{ name: "token", type: "address" }],
    outputs: [{ type: "bool" }],
    stateMutability: "view",
  },
] as const;

const erc20Abi = [
  {
    name: "approve",
    type: "function",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
    stateMutability: "nonpayable",
  },
] as const;

/**
 * Gas Station — Two modes:
 * 1. Sponsor: Deployer sends free tXDC (simulates AA paymaster)
 * 2. ERC20: User swaps ERC20 tokens for tXDC via TokenGasPaymaster
 */
export async function POST(request: Request) {
  try {
    if (!deployerKey) {
      return NextResponse.json(
        { success: false, error: "Gas station not configured" },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { to, mode, tokenAddress, xdcAmount }: 
      { to?: string; mode?: "sponsor" | "erc20"; tokenAddress?: string; xdcAmount?: string } = body;

    if (!to || !to.startsWith("0x") || to.length !== 42) {
      return NextResponse.json({ success: false, error: "Invalid address" }, { status: 400 });
    }

    const deployerAccount = privateKeyToAccount(deployerKey as `0x${string}`);
    const publicClient = createPublicClient({ chain: viemChain, transport: http(rpcUrl) });

    // ── MODE: ERC20 Swap ──
    if (mode === "erc20" && tokenAddress && paymasterAddress) {
      // Check if token is supported
      const isSupported = await publicClient.readContract({
        address: paymasterAddress,
        abi: paymasterAbi,
        functionName: "supportedTokens",
        args: [tokenAddress as `0x${string}`],
      });
      
      if (!isSupported) {
        return NextResponse.json({ success: false, error: "Token not supported by paymaster" }, { status: 400 });
      }

      const neededXdc = xdcAmount ? BigInt(xdcAmount) : parseEther("0.03");
      
      // Preview how many tokens needed
      const tokenNeeded = await publicClient.readContract({
        address: paymasterAddress,
        abi: paymasterAbi,
        functionName: "previewSwap",
        args: [tokenAddress as `0x${string}`, neededXdc],
      });

      // User must have approved paymaster to spend their tokens
      // We do the swap as the user (need their private key — this is a client-side flow issue)
      // For server-side, we can't sign as the user. 
      // Instead: return the preview and let client do the swap.
      return NextResponse.json({
        success: true,
        mode: "erc20",
        preview: {
          xdcAmount: neededXdc.toString(),
          tokenAmount: (tokenNeeded as bigint).toString(),
          tokenAddress,
          paymasterAddress,
        },
        message: "Approve paymaster and call swap() with these parameters",
      });
    }

    // ── MODE: Sponsor (default) ──
    const deployerBalance = await publicClient.getBalance({ address: deployerAccount.address });
    if (deployerBalance < parseEther("0.1")) {
      return NextResponse.json(
        { success: false, error: "Deployer wallet low on tXDC" },
        { status: 503 }
      );
    }

    const recipientBalance = await publicClient.getBalance({ address: to as `0x${string}` });
    if (recipientBalance >= parseEther("0.03")) {
      return NextResponse.json({ success: true, funded: false, reason: "Already has gas" });
    }

    const walletClient = createWalletClient({
      account: deployerAccount,
      chain: viemChain,
      transport: http(rpcUrl),
    });

    const txHash = await walletClient.sendTransaction({
      to: to as `0x${string}`,
      value: parseEther("0.03"),
    });

    // Wait for receipt
    let receipt = null;
    for (let i = 0; i < 20; i++) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      try {
        receipt = await publicClient.getTransactionReceipt({ hash: txHash });
        if (receipt) break;
      } catch { /* retry */ }
    }

    if (!receipt || receipt.status !== "success") {
      return NextResponse.json({ success: false, error: "Funding tx failed" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      funded: true,
      txHash,
      amount: "0.03",
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
