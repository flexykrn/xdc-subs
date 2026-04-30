const { createPublicClient, http, parseAbi, encodeFunctionData } = require("viem");
const RPC = "https://erpc.apothem.network";
const SA = "0x6302F0b313374c604067e286C17354527F9692fD";
const SUBMAN = "0xe8271C9Bc2255A41cd2AB53FbfB69CE4B5f3032E";

async function main() {
  const client = createPublicClient({ transport: http(RPC) });
  
  // Build execute(SubMan, 0, subscribe(4))
  const subscribeData = encodeFunctionData({
    abi: parseAbi(["function subscribe(uint256 planId) returns (uint256 subscriptionId)"]),
    functionName: "subscribe",
    args: [4n],
  });
  
  const executeData = encodeFunctionData({
    abi: parseAbi(["function execute(address target, uint256 value, bytes calldata data) external"]),
    functionName: "execute",
    args: [SUBMAN, 0n, subscribeData],
  });
  
  console.log("execute() calldata:", executeData);
  
  // Try calling directly
  try {
    await client.call({ to: SA, data: executeData });
    console.log("execute() call: succeeded");
  } catch(e) {
    console.log("execute() call failed:", e.shortMessage || e.message);
    if (e.data) console.log("Error data:", e.data);
  }
}

main().catch(console.error);
