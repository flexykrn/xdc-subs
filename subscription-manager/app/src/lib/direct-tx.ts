import { APOTHEM_CHAIN } from "@/config/chains";
import { createWalletClient, createPublicClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const rpcUrl = process.env.NEXT_PUBLIC_APOTHEM_RPC_URL || "https://erpc.apothem.network";

const viemChain = {
  id: APOTHEM_CHAIN.chainIdDecimal,
  name: APOTHEM_CHAIN.chainName,
  nativeCurrency: APOTHEM_CHAIN.nativeCurrency,
  rpcUrls: {
    default: { http: [APOTHEM_CHAIN.rpcUrl] },
    public: { http: [APOTHEM_CHAIN.rpcUrl] },
  },
  blockExplorers: {
    default: { name: "Apothem Explorer", url: APOTHEM_CHAIN.explorerUrl },
  },
  testnet: true,
} as const;

const publicClient = createPublicClient({
  chain: viemChain,
  transport: http(rpcUrl),
});

const subscriptionManagerAbi = [
  {
    name: "subscribe",
    type: "function",
    inputs: [{ name: "planId", type: "uint256" }],
    outputs: [{ name: "subscriptionId", type: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    name: "renew",
    type: "function",
    inputs: [{ name: "subscriptionId", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    name: "pause",
    type: "function",
    inputs: [{ name: "subscriptionId", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    name: "cancel",
    type: "function",
    inputs: [{ name: "subscriptionId", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
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
  {
    name: "allowance",
    type: "function",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
] as const;

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
] as const;

const PAYMASTER_ADDRESS = (process.env.NEXT_PUBLIC_PAYMASTER_ADDRESS || "") as `0x${string}`;

export interface DirectTxResult {
  txHash: string;
  subscriptionId?: string;
  explorerUrl: string;
}

/**
 * Ensure user has gas. Two modes:
 * - "sponsor": Deployer sends free tXDC
 * - "erc20": User swaps ERC20 tokens for tXDC via paymaster
 */
async function ensureGas(
  account: ReturnType<typeof privateKeyToAccount>,
  mode: "sponsor" | "erc20" = "sponsor",
  tokenAddress?: string
): Promise<void> {
  const balance = await publicClient.getBalance({ address: account.address });
  console.log("[DirectTx] Balance:", (Number(balance) / 1e18).toFixed(6), "tXDC");

  if (balance >= parseEther("0.01")) {
    console.log("[DirectTx] User has gas, no action needed");
    return;
  }

  // ── ERC20 Mode: Swap tokens for tXDC ──
  if (mode === "erc20" && tokenAddress && PAYMASTER_ADDRESS) {
    console.log("[DirectTx] ERC20 mode: swapping tokens for gas...");
    const walletClient = createWalletClient({
      account,
      chain: viemChain,
      transport: http(rpcUrl),
    });

    const neededXdc = parseEther("0.03");

    // Preview token cost
    const tokenNeeded = await publicClient.readContract({
      address: PAYMASTER_ADDRESS,
      abi: paymasterAbi,
      functionName: "previewSwap",
      args: [tokenAddress as `0x${string}`, neededXdc],
    }) as bigint;

    console.log("[DirectTx] Swap preview:", {
      xdcNeeded: (Number(neededXdc) / 1e18).toString(),
      tokenNeeded: (Number(tokenNeeded) / 1e18).toString(),
    });

    // Approve paymaster to take tokens
    const approveHash = await walletClient.writeContract({
      address: tokenAddress as `0x${string}`,
      abi: erc20Abi,
      functionName: "approve",
      args: [PAYMASTER_ADDRESS, tokenNeeded * BigInt(2)], // 2x buffer
    });
    console.log("[DirectTx] Paymaster approve tx:", approveHash);

    // Wait for approval
    let receipt = null;
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      try {
        receipt = await publicClient.getTransactionReceipt({ hash: approveHash });
        if (receipt && receipt.status === "success") break;
      } catch { /* retry */ }
    }
    if (!receipt || receipt.status !== "success") {
      throw new Error("Paymaster token approval failed");
    }

    // Execute swap
    const swapHash = await walletClient.writeContract({
      address: PAYMASTER_ADDRESS,
      abi: paymasterAbi,
      functionName: "swap",
      args: [tokenAddress as `0x${string}`, neededXdc],
    });
    console.log("[DirectTx] Swap tx:", swapHash);

    // Wait for swap
    receipt = null;
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      try {
        receipt = await publicClient.getTransactionReceipt({ hash: swapHash });
        if (receipt && receipt.status === "success") break;
      } catch { /* retry */ }
    }
    if (!receipt || receipt.status !== "success") {
      throw new Error("Token swap for gas failed");
    }

    await new Promise((r) => setTimeout(r, 2000));
    const newBal = await publicClient.getBalance({ address: account.address });
    console.log("[DirectTx] After swap:", (Number(newBal) / 1e18).toFixed(6), "tXDC");
    return;
  }

  // ── Sponsor Mode: Deployer sends free tXDC ──
  console.log("[DirectTx] Sponsor mode: requesting deployer gas...");
  const res = await fetch("/api/gas-station", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ to: account.address }),
  });
  const data = await res.json();
  console.log("[DirectTx] Gas station:", data);

  if (!data.success) {
    throw new Error("Gas station failed: " + (data.error || "Unknown"));
  }
  if (!data.funded) {
    console.log("[DirectTx] Gas station skipped:", data.reason);
    return;
  }

  await new Promise((r) => setTimeout(r, 4000));
  const newBal = await publicClient.getBalance({ address: account.address });
  if (newBal < parseEther("0.005")) {
    throw new Error("Gas did not arrive. Retry or use external faucet.");
  }
  console.log("[DirectTx] Funded:", (Number(newBal) / 1e18).toFixed(6), "tXDC");
}

function parseEther(amount: string): bigint {
  const [whole, frac = ""] = amount.split(".");
  const decimals = 18;
  const padded = (frac + "0".repeat(decimals)).slice(0, decimals);
  return BigInt(whole) * BigInt(10 ** decimals) + BigInt(padded);
}

export async function subscribeDirect(
  privateKey: string,
  subscriptionManagerAddress: string,
  planId: number,
  tokenAddress?: string,
  price?: string,
  mode: "sponsor" | "erc20" = "sponsor"
): Promise<DirectTxResult> {
  const account = privateKeyToAccount(privateKey as `0x${string}`);
  const walletClient = createWalletClient({
    account,
    chain: viemChain,
    transport: http(rpcUrl),
  });

  // Ensure gas based on mode
  await ensureGas(account, mode, tokenAddress);

  // If ERC20 mode, approve first
  if (tokenAddress && price) {
    const allowance = await publicClient.readContract({
      address: tokenAddress as `0x${string}`,
      abi: erc20Abi,
      functionName: "allowance",
      args: [account.address, subscriptionManagerAddress as `0x${string}`],
    });

    if ((allowance as bigint) < BigInt(price)) {
      const approveHash = await walletClient.writeContract({
        address: tokenAddress as `0x${string}`,
        abi: erc20Abi,
        functionName: "approve",
        args: [subscriptionManagerAddress as `0x${string}`, BigInt(price) * BigInt(10)],
      });
      console.log("[DirectTx] Approval tx:", approveHash);
      
      // Wait for approval
      let receipt = null;
      for (let i = 0; i < 30; i++) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        try {
          receipt = await publicClient.getTransactionReceipt({ hash: approveHash });
          if (receipt && receipt.status === 'success') break;
        } catch { /* retry */ }
      }
      if (!receipt || receipt.status !== 'success') {
        throw new Error("Token approval failed or timed out.");
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  // Subscribe
  const txHash = await walletClient.writeContract({
    address: subscriptionManagerAddress as `0x${string}`,
    abi: subscriptionManagerAbi,
    functionName: "subscribe",
    args: [BigInt(planId)],
  });

  const explorerUrl = `${process.env.NEXT_PUBLIC_EXPLORER_URL || "https://explorer.apothem.network/"}tx/${txHash}`;
  return { txHash, explorerUrl };
}

export async function renewDirect(
  privateKey: string,
  subscriptionManagerAddress: string,
  subscriptionId: number
): Promise<DirectTxResult> {
  const account = privateKeyToAccount(privateKey as `0x${string}`);
  const walletClient = createWalletClient({
    account,
    chain: viemChain,
    transport: http(rpcUrl),
  });

  await ensureGas(account);

  const txHash = await walletClient.writeContract({
    address: subscriptionManagerAddress as `0x${string}`,
    abi: subscriptionManagerAbi,
    functionName: "renew",
    args: [BigInt(subscriptionId)],
  });

  const explorerUrl = `${process.env.NEXT_PUBLIC_EXPLORER_URL || "https://explorer.apothem.network/"}tx/${txHash}`;
  return { txHash, explorerUrl };
}

export async function pauseDirect(
  privateKey: string,
  subscriptionManagerAddress: string,
  subscriptionId: number
): Promise<DirectTxResult> {
  const account = privateKeyToAccount(privateKey as `0x${string}`);
  const walletClient = createWalletClient({
    account,
    chain: viemChain,
    transport: http(rpcUrl),
  });

  await ensureGas(account);

  const txHash = await walletClient.writeContract({
    address: subscriptionManagerAddress as `0x${string}`,
    abi: subscriptionManagerAbi,
    functionName: "pause",
    args: [BigInt(subscriptionId)],
  });

  const explorerUrl = `${process.env.NEXT_PUBLIC_EXPLORER_URL || "https://explorer.apothem.network/"}tx/${txHash}`;
  return { txHash, explorerUrl };
}

export async function cancelDirect(
  privateKey: string,
  subscriptionManagerAddress: string,
  subscriptionId: number
): Promise<DirectTxResult> {
  const account = privateKeyToAccount(privateKey as `0x${string}`);
  const walletClient = createWalletClient({
    account,
    chain: viemChain,
    transport: http(rpcUrl),
  });

  await ensureGas(account);

  const txHash = await walletClient.writeContract({
    address: subscriptionManagerAddress as `0x${string}`,
    abi: subscriptionManagerAbi,
    functionName: "cancel",
    args: [BigInt(subscriptionId)],
  });

  const explorerUrl = `${process.env.NEXT_PUBLIC_EXPLORER_URL || "https://explorer.apothem.network/"}tx/${txHash}`;
  return { txHash, explorerUrl };
}
