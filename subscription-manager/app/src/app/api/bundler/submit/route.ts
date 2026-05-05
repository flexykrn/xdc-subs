import { NextRequest, NextResponse } from "next/server";
import {
  createWalletClient,
  http,
  createPublicClient,
  parseAbi,
  keccak256,
  encodePacked,
  encodeAbiParameters,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

const RPC_URL = process.env.NEXT_PUBLIC_APOTHEM_RPC_URL || "https://erpc.apothem.network";

const ENTRYPOINT = process.env.NEXT_PUBLIC_ENTRYPOINT_ADDRESS as `0x${string}`;
if (!ENTRYPOINT || ENTRYPOINT === "0x") {
  throw new Error("NEXT_PUBLIC_ENTRYPOINT_ADDRESS not set in environment");
}

const PAYMASTER = process.env.NEXT_PUBLIC_PAYMASTER_ADDRESS as `0x${string}`;
if (!PAYMASTER || PAYMASTER === "0x") {
  throw new Error("NEXT_PUBLIC_PAYMASTER_ADDRESS not set in environment");
}

const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID || 51);
const PAYMASTER_KEY = process.env.PAYMASTER_PRIVATE_KEY || process.env.DEPLOYER_PRIVATE_KEY;

function requireServerEnv(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`Missing server env: ${name}`);
  return val;
}

const bundlerKey = requireServerEnv("BUNDLER_PRIVATE_KEY");
const bundlerAccount = privateKeyToAccount(bundlerKey as `0x${string}`);

const walletClient = createWalletClient({
  account: bundlerAccount,
  transport: http(RPC_URL),
});

const publicClient = createPublicClient({
  transport: http(RPC_URL),
});

const entryPointAbi = parseAbi([
  "function handleOps((address sender, uint256 nonce, bytes initCode, bytes callData, bytes32 accountGasLimits, uint256 preVerificationGas, bytes32 gasFees, bytes paymasterAndData, bytes signature)[] ops, address beneficiary) external",
  "function getUserOpHash((address sender, uint256 nonce, bytes initCode, bytes callData, bytes32 accountGasLimits, uint256 preVerificationGas, bytes32 gasFees, bytes paymasterAndData, bytes signature) userOp) external view returns (bytes32)",
  "function depositTo(address account) payable",
]);

type PackedUserOp = {
  sender: `0x${string}`;
  nonce: bigint;
  initCode: `0x${string}`;
  callData: `0x${string}`;
  accountGasLimits: `0x${string}`;
  preVerificationGas: bigint;
  gasFees: `0x${string}`;
  paymasterAndData: `0x${string}`;
  signature: `0x${string}`;
};

function getUserOpHash(userOp: PackedUserOp): `0x${string}` {
  const innerHash = keccak256(encodeAbiParameters(
    [
      { type: "address" },
      { type: "uint256" },
      { type: "bytes32" },
      { type: "bytes32" },
      { type: "bytes32" },
      { type: "uint256" },
      { type: "bytes32" },
      { type: "bytes32" },
    ],
    [
      userOp.sender,
      userOp.nonce,
      keccak256(userOp.initCode),
      keccak256(userOp.callData),
      userOp.accountGasLimits,
      userOp.preVerificationGas,
      userOp.gasFees,
      keccak256(userOp.paymasterAndData),
    ]
  ));

  return keccak256(encodeAbiParameters(
    [
      { type: "bytes32" },
      { type: "address" },
      { type: "uint256" },
    ],
    [innerHash, ENTRYPOINT, BigInt(CHAIN_ID)]
  ));
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userOp: rawUserOp, mode } = body;

    const userOp: PackedUserOp = {
      sender: rawUserOp.sender as `0x${string}`,
      nonce: BigInt(rawUserOp.nonce),
      initCode: rawUserOp.initCode as `0x${string}`,
      callData: rawUserOp.callData as `0x${string}`,
      accountGasLimits: rawUserOp.accountGasLimits as `0x${string}`,
      preVerificationGas: BigInt(rawUserOp.preVerificationGas),
      gasFees: rawUserOp.gasFees as `0x${string}`,
      paymasterAndData: rawUserOp.paymasterAndData as `0x${string}`,
      signature: rawUserOp.signature as `0x${string}`,
    };

    // Validate paymasterAndData for sponsor mode (must have signature)
    if (mode === "sponsor" && (!userOp.paymasterAndData || userOp.paymasterAndData === "0x")) {
      throw new Error("PaymasterAndData required for sponsor mode");
    }

    // ERC20 mode must have paymasterAndData with token address
    if (mode === "erc20" && (!userOp.paymasterAndData || userOp.paymasterAndData.length < 72)) {
      throw new Error("PaymasterAndData must include token address for erc20 mode");
    }

    // Submit to EntryPoint
    const txHash = await walletClient.writeContract({
      address: ENTRYPOINT,
      abi: entryPointAbi,
      functionName: "handleOps",
      args: [[userOp], bundlerAccount.address],
      chain: null,
      gas: 2000000n,
    });

    const userOpHash = getUserOpHash(userOp);

    return NextResponse.json({
      success: true,
      txHash,
      userOpHash,
      bundler: bundlerAccount.address,
    });

  } catch (err) {
    console.error("[Bundler] Error:", err);
    const msg = err instanceof Error ? err.message : "Bundler submission failed";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
