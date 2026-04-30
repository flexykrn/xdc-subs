const { ethers } = require("ethers");

const RPC_URL = "https://erpc.apothem.network";
const TX_HASH = "0x1b7a242f4175e019904ffa4f75e7337ecbf7156febf9dd464a9efe8e7679b67f";
const ENTRYPOINT = "0x0000000071727De22E5E9d8BAf0edAc6f37da032";

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  
  // Get the transaction
  const tx = await provider.getTransaction(TX_HASH);
  const receipt = await provider.getTransactionReceipt(TX_HASH);
  
  console.log("=== ERC20 FAILURE TX ===");
  console.log("Status:", receipt?.status === 1 ? "SUCCESS" : "FAILED");
  console.log("From:", tx?.from);
  console.log("To:", tx?.to);
  console.log("Gas used:", receipt?.gasUsed?.toString());
  
  // Trace the call
  try {
    const trace = await provider.send("debug_traceTransaction", [TX_HASH, {}]);
    console.log("\nTrace:", JSON.stringify(trace, null, 2).substring(0, 2000));
  } catch(e) {
    console.log("\nTrace failed:", e.message);
  }
  
  // Check EntryPoint events
  const entryPoint = new ethers.Contract(ENTRYPOINT, [
    "event UserOperationRevertReason(bytes32 indexed userOpHash, address indexed sender, uint256 nonce, bytes revertReason)",
    "event AccountDeployed(bytes32 indexed userOpHash, address indexed sender, address factory, address account)",
  ], provider);
  
  const logs = receipt?.logs || [];
  console.log("\n=== LOGS ===");
  for (const log of logs) {
    console.log("Log address:", log.address);
    console.log("Topics:", log.topics);
    console.log("Data:", log.data?.substring(0, 100));
    console.log("---");
  }
}

main().catch(console.error);
