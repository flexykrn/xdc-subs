import { NextRequest, NextResponse } from "next/server";
import {
  keccak256,
  encodeAbiParameters,
  concat,
  toHex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

const PAYMASTER_KEY = process.env.PAYMASTER_PRIVATE_KEY || process.env.DEPLOYER_PRIVATE_KEY;
const PAYMASTER_ADDRESS = (process.env.NEXT_PUBLIC_PAYMASTER_ADDRESS || "0x8361Fae5A25e71C2E1db35cDE13E7150bB7b1a42") as `0x${string}`;
const CHAIN_ID = 51;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sender, nonce, initCode, callData, accountGasLimits, preVerificationGas, gasFees } = body;

    if (!PAYMASTER_KEY) {
      return NextResponse.json({ error: "Paymaster key not configured" }, { status: 500 });
    }

    // Decode gasFees into maxPriorityFeePerGas and maxFeePerGas
    // gasFees = toHex((maxPriorityFeePerGas << 128n) | maxFeePerGas, { size: 32 })
    const gasFeesHex = (gasFees as string).slice(2); // remove 0x
    const maxPriorityFeePerGas = BigInt("0x" + gasFeesHex.slice(0, 32));
    const maxFeePerGas = BigInt("0x" + gasFeesHex.slice(32, 64));

    // Compute hash exactly as VerifyingSponsorPaymaster.getHash() does:
    // keccak256(abi.encode(sender, nonce, keccak256(initCode), keccak256(callData), accountGasLimits, preVerificationGas, maxPriorityFeePerGas, maxFeePerGas, chainid, address(this)))
    const hash = keccak256(encodeAbiParameters(
      [
        { type: "address" },
        { type: "uint256" },
        { type: "bytes32" },
        { type: "bytes32" },
        { type: "bytes32" },
        { type: "uint256" },
        { type: "uint256" },
        { type: "uint256" },
        { type: "uint256" },
        { type: "address" },
      ],
      [
        sender as `0x${string}`,
        BigInt(nonce),
        keccak256(initCode as `0x${string}`),
        keccak256(callData as `0x${string}`),
        accountGasLimits as `0x${string}`,
        BigInt(preVerificationGas),
        maxPriorityFeePerGas,
        maxFeePerGas,
        BigInt(CHAIN_ID),
        PAYMASTER_ADDRESS,
      ]
    ));

    const account = privateKeyToAccount(PAYMASTER_KEY as `0x${string}`);

    // signMessage adds \x19Ethereum Signed Message:\n32 prefix
    // The contract uses MessageHashUtils.toEthSignedMessageHash(hash) internally
    const signature = await account.signMessage({ message: { raw: hash } });

    // Construct paymasterAndData:
    // [0:20]   paymaster address
    // [20:36]  paymasterVerificationGasLimit (uint128, 16 bytes)
    // [36:52]  paymasterPostOpGasLimit (uint128, 16 bytes)
    // [52:]    signature (65 bytes)
    const paymasterAndData = concat([
      PAYMASTER_ADDRESS,
      toHex(100000n, { size: 16 }),  // paymasterVerificationGasLimit
      toHex(0n, { size: 16 }),        // paymasterPostOpGasLimit (no post-op logic)
      signature,
    ]);

    return NextResponse.json({
      paymasterAndData,
      paymasterAddress: PAYMASTER_ADDRESS,
    });

  } catch (err) {
    console.error("[Paymaster Sign] Error:", err);
    const msg = err instanceof Error ? err.message : "Paymaster signing failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
