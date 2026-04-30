const { createPublicClient, http, parseAbi, encodeFunctionData, keccak256, encodeAbiParameters } = require("viem");
const RPC = "https://erpc.apothem.network";
const SA = "0x6302F0b313374c604067e286C17354527F9692fD";
const SUBMAN = "0xe8271C9Bc2255A41cd2AB53FbfB69CE4B5f3032E";
const ENTRYPOINT = "0x0000000071727De22E5E9d8BAf0edAc6f37da032";
const PAYMASTER = "0x8361Fae5A25e71C2E1db35cDE13E7150bB7b1a42";
const NETFLIX = "0x896F79883Bf0620Afcd3D8942f1Db8d3F447AE84";

async function main() {
  const client = createPublicClient({ transport: http(RPC) });

  // Get SA nonce
  const nonce = await client.readContract({
    address: ENTRYPOINT,
    abi: parseAbi(["function getNonce(address sender, uint192 key) view returns (uint256)"]),
    functionName: "getNonce",
    args: [SA, 0n],
  });
  console.log("SA nonce:", nonce.toString());

  // Build approve UserOp with execute() wrapper
  const approveData = encodeFunctionData({
    abi: parseAbi(["function approve(address spender, uint256 amount) returns (bool)"]),
    functionName: "approve",
    args: [SUBMAN, BigInt(5) * BigInt(10 ** 18)],
  });

  const executeApprove = encodeFunctionData({
    abi: parseAbi(["function execute(address target, uint256 value, bytes calldata data) external"]),
    functionName: "execute",
    args: [NETFLIX, 0n, approveData],
  });

  // Build subscribe UserOp with execute() wrapper
  const subscribeData = encodeFunctionData({
    abi: parseAbi(["function subscribe(uint256 planId) returns (uint256 subscriptionId)"]),
    functionName: "subscribe",
    args: [1n],
  });

  const executeSubscribe = encodeFunctionData({
    abi: parseAbi(["function execute(address target, uint256 value, bytes calldata data) external"]),
    functionName: "execute",
    args: [SUBMAN, 0n, subscribeData],
  });

  console.log("\n=== Approve callData ===");
  console.log("Inner (approve):", approveData);
  console.log("Wrapped (execute):", executeApprove);

  console.log("\n=== Subscribe callData ===");
  console.log("Inner (subscribe):", subscribeData);
  console.log("Wrapped (execute):", executeSubscribe);

  // Try calling the SA with executeApprove (as EntryPoint would)
  console.log("\n=== Simulating direct execute call ===");
  try {
    await client.call({ to: SA, data: executeApprove, from: ENTRYPOINT });
    console.log("Direct execute(from=EntryPoint): SUCCESS");
  } catch (e) {
    console.log("Direct execute failed:", e.shortMessage || e.message);
    if (e.data) console.log("Error data:", e.data);
  }

  // Also try subscribe
  try {
    await client.call({ to: SA, data: executeSubscribe, from: ENTRYPOINT });
    console.log("Direct subscribe(from=EntryPoint): SUCCESS");
  } catch (e) {
    console.log("Direct subscribe failed:", e.shortMessage || e.message);
    if (e.data) console.log("Error data:", e.data);
  }
}

main().catch(console.error);
