const { ethers } = require("ethers");

const RPC_URL = "https://erpc.apothem.network";
const TX_HASH = "0x1b7a242f4175e019904ffa4f75e7337ecbf7156febf9dd464a9efe8e7679b67f";
const ENTRYPOINT = "0x0000000071727De22E5E9d8BAf0edAc6f37da032";
const EP_ABI = [
  "event UserOperationRevertReason(bytes32 indexed userOpHash, address indexed sender, uint256 nonce, bytes revertReason)",
  "event AccountDeployed(bytes32 indexed userOpHash, address indexed sender, address factory, address account)"
];

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const receipt = await provider.getTransactionReceipt(TX_HASH);
  
  console.log("Status:", receipt.status === 1 ? "SUCCESS" : "FAILED");
  console.log("Gas used:", receipt.gasUsed.toString());
  
  // Parse EntryPoint events
  const ep = new ethers.Contract(ENTRYPOINT, EP_ABI, provider);
  const iface = ep.interface;
  
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() === ENTRYPOINT.toLowerCase()) {
      try {
        const parsed = iface.parseLog(log);
        console.log("\n=== ENTRYPOINT EVENT ===");
        console.log("Event:", parsed.name);
        console.log("Args:", parsed.args);
      } catch(e) {
        console.log("\nLog topic:", log.topics[0]);
        console.log("Data:", log.data);
      }
    }
  }
  
  // Also try to get the transaction data to decode the UserOp
  const tx = await provider.getTransaction(TX_HASH);
  console.log("\n=== TX DATA ===");
  console.log("To:", tx.to);
  console.log("Data length:", tx.data.length);
  console.log("Data (first 200 chars):", tx.data.substring(0, 200));
}

main().catch(console.error);
