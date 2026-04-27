import { NextResponse } from "next/server";
import { createWalletClient, createPublicClient, http, concat, toHex } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const rpcUrl = process.env.NEXT_PUBLIC_APOTHEM_RPC_URL || "https://erpc.apothem.network";
const entryPointAddress = (process.env.ENTRYPOINT_ADDRESS || "0x0000000071727De22E5E9d8BAf0edAc6f37da032") as `0x${string}`;
const paymasterAddress = (process.env.PAYMASTER_ADDRESS || "") as `0x${string}`;
const paymasterPrivateKey = process.env.PAYMASTER_PRIVATE_KEY || "";
const chainId = 51;

const viemChain = {
  id: chainId,
  name: "XDC Apothem",
  nativeCurrency: { name: "XDC", symbol: "XDC", decimals: 18 },
  rpcUrls: { default: { http: [rpcUrl] }, public: { http: [rpcUrl] } },
  testnet: true,
} as const;

// EntryPoint v0.7 handleOps ABI
const entryPointAbi = [
  {
    name: "handleOps",
    type: "function",
    inputs: [
      {
        name: "ops",
        type: "tuple[]",
        components: [
          { name: "sender", type: "address" },
          { name: "nonce", type: "uint256" },
          { name: "initCode", type: "bytes" },
          { name: "callData", type: "bytes" },
          { name: "accountGasLimits", type: "bytes32" },
          { name: "preVerificationGas", type: "uint256" },
          { name: "gasFees", type: "bytes32" },
          { name: "paymasterAndData", type: "bytes" },
          { name: "signature", type: "bytes" },
        ],
      },
      { name: "beneficiary", type: "address" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    name: "getUserOpHash",
    type: "function",
    inputs: [
      {
        name: "userOp",
        type: "tuple",
        components: [
          { name: "sender", type: "address" },
          { name: "nonce", type: "uint256" },
          { name: "initCode", type: "bytes" },
          { name: "callData", type: "bytes" },
          { name: "accountGasLimits", type: "bytes32" },
          { name: "preVerificationGas", type: "uint256" },
          { name: "gasFees", type: "bytes32" },
          { name: "paymasterAndData", type: "bytes" },
          { name: "signature", type: "bytes" },
        ],
      },
    ],
    outputs: [{ name: "", type: "bytes32" }],
    stateMutability: "view",
  },
] as const;

interface PackedUserOperation {
  sender: `0x${string}`;
  nonce: string | bigint;
  initCode: `0x${string}`;
  callData: `0x${string}`;
  accountGasLimits: `0x${string}`;
  preVerificationGas: string | bigint;
  gasFees: `0x${string}`;
  paymasterAndData: `0x${string}`;
  signature: `0x${string}`;
}

export async function POST(request: Request) {
  try {
    if (!paymasterPrivateKey) {
      return NextResponse.json(
        { success: false, error: "Relay not configured — missing paymaster key" },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { userOp }: { userOp: PackedUserOperation } = body;

    if (!userOp) {
      return NextResponse.json(
        { success: false, error: "Missing userOp" },
        { status: 400 }
      );
    }

    const relayAccount = privateKeyToAccount(paymasterPrivateKey as `0x${string}`);

    const walletClient = createWalletClient({
      account: relayAccount,
      chain: viemChain,
      transport: http(rpcUrl),
    });

    const publicClient = createPublicClient({
      chain: viemChain,
      transport: http(rpcUrl),
    });

    // Validate the userOp paymaster data is for our paymaster
    const pmFromUserOp = userOp.paymasterAndData.slice(0, 42) as `0x${string}`;
    if (pmFromUserOp.toLowerCase() !== paymasterAddress.toLowerCase()) {
      return NextResponse.json(
        { success: false, error: `Invalid paymaster address: ${pmFromUserOp}` },
        { status: 400 }
      );
    }

    // Optional: simulate validation before submitting (save gas if invalid)
    try {
      await publicClient.simulateContract({
        address: entryPointAddress,
        abi: entryPointAbi,
        functionName: "handleOps",
        args: [
          [
            {
              sender: userOp.sender,
              nonce: BigInt(userOp.nonce),
              initCode: userOp.initCode,
              callData: userOp.callData,
              accountGasLimits: userOp.accountGasLimits,
              preVerificationGas: BigInt(userOp.preVerificationGas),
              gasFees: userOp.gasFees,
              paymasterAndData: userOp.paymasterAndData,
              signature: userOp.signature,
            },
          ],
          relayAccount.address,
        ],
        account: relayAccount,
      });
    } catch (simError) {
      console.warn("[Relay] Simulation failed:", simError);
      // Continue anyway — some nodes don't support simulation well
    }

    // Submit to EntryPoint
    const txHash = await walletClient.writeContract({
      address: entryPointAddress,
      abi: entryPointAbi,
      functionName: "handleOps",
      args: [
        [
          {
            sender: userOp.sender,
            nonce: BigInt(userOp.nonce),
            initCode: userOp.initCode,
            callData: userOp.callData,
            accountGasLimits: userOp.accountGasLimits,
            preVerificationGas: BigInt(userOp.preVerificationGas),
            gasFees: userOp.gasFees,
            paymasterAndData: userOp.paymasterAndData,
            signature: userOp.signature,
          },
        ],
        relayAccount.address,
      ],
    });

    console.log("[Relay] Submitted UserOp, txHash:", txHash);

    // Wait for receipt
    let receipt = null;
    for (let i = 0; i < 30; i++) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      try {
        receipt = await publicClient.getTransactionReceipt({ hash: txHash });
        if (receipt) break;
      } catch {
        // not yet mined
      }
    }

    return NextResponse.json({
      success: true,
      txHash,
      status: receipt?.status ?? "pending",
      blockNumber: receipt?.blockNumber ? String(receipt.blockNumber) : null,
    });
  } catch (error) {
    console.error("[Relay] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        details: String(error),
      },
      { status: 500 }
    );
  }
}
