import { NextResponse } from "next/server";
import {
  createWalletClient,
  createPublicClient,
  http,
  keccak256,
  encodeAbiParameters,
  parseAbiParameters,
  concat,
  toHex,
  hexToBytes,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

const rpcUrl = process.env.NEXT_PUBLIC_APOTHEM_RPC_URL || "https://erpc.apothem.network";
const paymasterAddress = (process.env.PAYMASTER_ADDRESS || "") as `0x${string}`;
const paymasterSignerKey =
  process.env.PAYMASTER_OWNER_PRIVATE_KEY ||
  process.env.DEPLOYER_PRIVATE_KEY ||
  process.env.PAYMASTER_PRIVATE_KEY ||
  "";
const chainId = 51;

const viemChain = {
  id: chainId,
  name: "XDC Apothem",
  nativeCurrency: { name: "XDC", symbol: "XDC", decimals: 18 },
  rpcUrls: { default: { http: [rpcUrl] }, public: { http: [rpcUrl] } },
  testnet: true,
} as const;

interface PackedUserOperation {
  sender: `0x${string}`;
  nonce: bigint | string;
  initCode: `0x${string}`;
  callData: `0x${string}`;
  accountGasLimits: `0x${string}`;
  preVerificationGas: bigint | string;
  gasFees: `0x${string}`;
  paymasterAndData: `0x${string}`;
  signature: `0x${string}`;
}

/**
 * Compute the paymaster hash matching Solidity VerifyingSponsorPaymaster.getHash()
 */
function getPaymasterHash(userOp: PackedUserOperation): `0x${string}` {
  // Decode gasFees: bytes32 = [maxPriorityFeePerGas:16 | maxFeePerGas:16]
  const gasFeesHex = userOp.gasFees.slice(2);
  const maxPriorityFeePerGas = BigInt("0x" + gasFeesHex.slice(0, 32));
  const maxFeePerGas = BigInt("0x" + gasFeesHex.slice(32, 64));

  return keccak256(
    encodeAbiParameters(
      parseAbiParameters(
        "address, uint256, bytes32, bytes32, bytes32, uint256, uint256, uint256, uint256, address"
      ),
      [
        userOp.sender,
        BigInt(userOp.nonce),
        keccak256(userOp.initCode),
        keccak256(userOp.callData),
        userOp.accountGasLimits,
        BigInt(userOp.preVerificationGas),
        maxPriorityFeePerGas,
        maxFeePerGas,
        BigInt(chainId),
        paymasterAddress,
      ]
    )
  );
}

export async function POST(request: Request) {
  try {
    if (!paymasterAddress || !paymasterSignerKey) {
      return NextResponse.json(
        { success: false, error: "Paymaster not configured (missing address or signer key)" },
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

    // Compute paymaster hash
    const hash = getPaymasterHash(userOp);

    // Sign the hash with paymaster owner key
    const ownerAccount = privateKeyToAccount(paymasterSignerKey as `0x${string}`);
    const signature = await ownerAccount.signMessage({
      message: { raw: hash },
    });

    // Build paymasterAndData
    // Structure: paymaster(20) + pmVerGasLimit(16) + pmPostOpGasLimit(16) + signature
    const pmVerGasLimit = toHex(100000n, { size: 16 });
    const pmPostOpGasLimit = toHex(50000n, { size: 16 });
    const paymasterAndData = concat([
      paymasterAddress,
      pmVerGasLimit,
      pmPostOpGasLimit,
      signature,
    ]);

    return NextResponse.json({
      success: true,
      paymasterAndData,
      paymasterHash: hash,
      paymasterSignature: signature,
    });
  } catch (error) {
    console.error("[PaymasterSign] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
