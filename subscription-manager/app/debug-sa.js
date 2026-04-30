const { createPublicClient, http, parseAbi, encodeFunctionData } = require("viem");
const RPC = "https://erpc.apothem.network";
const SA = "0x6302F0b313374c604067e286C17354527F9692fD";
const SUBMAN = "0xe8271C9Bc2255A41cd2AB53FbfB69CE4B5f3032E";

const TOKENS = {
  Netflix: "0x896F79883Bf0620Afcd3D8942f1Db8d3F447AE84",
  Spotify: "0x9F00925759A9F0FEb13373336B761A7267AE66a9",
  YouTube: "0x591CCebbd943a2F9a11F64eBf627d86600a0f38e",
  JioHotstar: "0x87CB2de7edc1B9D725a5a6DeDdcbEF7e36fe3084",
  Claude: "0xA228078133e812677533166A44187c1Ae696687A",
  Copilot: "0x4c4456bF7A0e572D2C697626025DcB6d3D3Df7D1",
};

async function main() {
  const client = createPublicClient({ transport: http(RPC) });

  console.log("=== SA Token Balances ===");
  for (const [name, addr] of Object.entries(TOKENS)) {
    const bal = await client.readContract({
      address: addr,
      abi: parseAbi(["function balanceOf(address) view returns (uint256)"]),
      functionName: "balanceOf",
      args: [SA],
    });
    const allowance = await client.readContract({
      address: addr,
      abi: parseAbi(["function allowance(address owner, address spender) view returns (uint256)"]),
      functionName: "allowance",
      args: [SA, SUBMAN],
    });
    console.log(name + ": " + Number(bal) / 1e18 + " tokens, allowance: " + Number(allowance) / 1e18);
  }

  console.log("\n=== Simulating approve via SA.execute() ===");

  // Build what the SA would receive: execute(Netflix, 0, approve(SubMan, 5e18))
  const approveData = encodeFunctionData({
    abi: parseAbi(["function approve(address spender, uint256 amount) returns (bool)"]),
    functionName: "approve",
    args: [SUBMAN, BigInt(5) * BigInt(10 ** 18)],
  });

  const executeData = encodeFunctionData({
    abi: parseAbi(["function execute(address target, uint256 value, bytes calldata data) external"]),
    functionName: "execute",
    args: [TOKENS.Netflix, 0n, approveData],
  });

  console.log("execute calldata:", executeData);

  // Try direct call to SA (will fail with "not Owner or EntryPoint" since we're not EntryPoint)
  try {
    await client.call({ to: SA, data: executeData });
    console.log("Direct call: SUCCESS (unexpected)");
  } catch (e) {
    console.log("Direct call failed:", e.shortMessage || e.message);
  }

  // Now try simulating via EntryPoint.handleOps
  console.log("\n=== Simulating via EntryPoint.handleOps ===");
  const ENTRYPOINT = "0x0000000071727De22E5E9d8BAf0edAc6f37da032";

  // Get actual nonce
  const nonce = await client.readContract({
    address: ENTRYPOINT,
    abi: parseAbi(["function getNonce(address sender, uint192 key) view returns (uint256)"]),
    functionName: "getNonce",
    args: [SA, 0n],
  });
  console.log("SA nonce:", nonce.toString());

  // Build UserOp
  const userOp = {
    sender: SA,
    nonce,
    initCode: "0x",
    callData: executeData,
    accountGasLimits: "0x0000000000000000000000000007a120000000000000000000000000000493e0",
    preVerificationGas: 50000n,
    gasFees: "0x0000000000000000000000003b9aca000000000000000000000000003b9aca00",
    paymasterAndData: "0x",
    signature: "0x",
  };

  // Try simulateHandleOp if available
  try {
    await client.readContract({
      address: ENTRYPOINT,
      abi: parseAbi(["function simulateHandleOp((address sender, uint256 nonce, bytes initCode, bytes callData, bytes32 accountGasLimits, uint256 preVerificationGas, bytes32 gasFees, bytes paymasterAndData, bytes signature) op, address target, bytes calldata callData) external"]),
      functionName: "simulateHandleOp",
      args: [userOp, SA, "0x"],
    });
    console.log("simulateHandleOp: ok");
  } catch (e) {
    console.log("simulateHandleOp error:", e.shortMessage || e.message);
  }
}

main().catch(console.error);
