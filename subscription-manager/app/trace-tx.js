const { createPublicClient, http, decodeFunctionData, parseAbi } = require("viem");

const RPC = "https://erpc.apothem.network";
const TX = "0x941f9ec988948381286fd1d1c2142d0162d6366fe0e0c1f0cde1cdd3bf547166";
const ENTRYPOINT = "0x0000000071727De22E5E9d8BAf0edAc6f37da032";

async function main() {
  const client = createPublicClient({ transport: http(RPC) });

  console.log("Fetching tx:", TX);

  const tx = await client.getTransaction({ hash: TX });
  console.log("\n=== Transaction ===");
  console.log("From:", tx.from);
  console.log("To:", tx.to);
  console.log("Gas limit:", tx.gas?.toString());
  console.log("Gas price:", tx.gasPrice?.toString());
  console.log("Value:", tx.value?.toString());
  console.log("Input length:", tx.input?.length);

  // Decode handleOps call
  try {
    const decoded = decodeFunctionData({
      abi: parseAbi(["function handleOps((address sender, uint256 nonce, bytes initCode, bytes callData, bytes32 accountGasLimits, uint256 preVerificationGas, bytes32 gasFees, bytes paymasterAndData, bytes signature)[] ops, address beneficiary) external"]),
      data: tx.input,
    });
    console.log("\n=== Decoded handleOps ===");
    console.log("Function:", decoded.functionName);
    console.log("Beneficiary:", decoded.args[1]);

    const userOp = decoded.args[0][0];
    console.log("\n=== UserOp ===");
    console.log("sender:", userOp.sender);
    console.log("nonce:", userOp.nonce.toString());
    console.log("initCode length:", userOp.initCode?.length);
    console.log("callData length:", userOp.callData?.length);
    console.log("accountGasLimits:", userOp.accountGasLimits);
    console.log("preVerificationGas:", userOp.preVerificationGas.toString());
    console.log("gasFees:", userOp.gasFees);
    console.log("paymasterAndData length:", userOp.paymasterAndData?.length);
    console.log("signature length:", userOp.signature?.length);

    // Decode gas limits
    const gasLimitsHex = userOp.accountGasLimits.slice(2);
    const vgl = BigInt("0x" + gasLimitsHex.slice(0, 32));
    const cgl = BigInt("0x" + gasLimitsHex.slice(32, 64));
    console.log("\n=== Decoded Gas ===");
    console.log("verificationGasLimit:", vgl.toString());
    console.log("callGasLimit:", cgl.toString());

    // Decode gas fees
    const gasFeesHex = userOp.gasFees.slice(2);
    const mpfpg = BigInt("0x" + gasFeesHex.slice(0, 32));
    const mfpg = BigInt("0x" + gasFeesHex.slice(32, 64));
    console.log("maxPriorityFeePerGas:", mpfpg.toString());
    console.log("maxFeePerGas:", mfpg.toString());

    // Calculate requiredPrefund
    const requiredPrefund = mfpg * (vgl + cgl + userOp.preVerificationGas);
    console.log("\n=== Cost Calculation ===");
    console.log("requiredPrefund:", requiredPrefund.toString(), "wei =", Number(requiredPrefund) / 1e18, "tXDC");

    // Check paymaster deposit
    const paymasterAddr = "0x" + userOp.paymasterAndData.slice(2, 42);
    console.log("\nPaymaster extracted:", paymasterAddr);

    const deposit = await client.readContract({
      address: ENTRYPOINT,
      abi: parseAbi(["function getDepositInfo(address account) view returns (uint112 deposit, bool staked, uint112 stake, uint32 unstakeDelaySec, uint48 withdrawTime)"]),
      functionName: "getDepositInfo",
      args: [paymasterAddr],
    });
    console.log("Paymaster deposit:", Number(deposit[0]).toString(), "wei =", Number(deposit[0]) / 1e18, "tXDC");
    console.log("Deposit >= requiredPrefund?", deposit[0] >= requiredPrefund ? "YES" : "NO");

  } catch (e) {
    console.error("Decode error:", e.message);
  }
}

main().catch(console.error);
