const { createPublicClient, http, parseAbi } = require("viem");

const RPC = "https://erpc.apothem.network";
const TX = "0x01da83cbda6f1cee419a694dee88ab09fc8b360385077cc15c6dbe9460737028";
const ENTRYPOINT = "0x0000000071727De22E5E9d8BAf0edAc6f37da032";

async function main() {
  const client = createPublicClient({ transport: http(RPC) });

  // Get receipt
  const receipt = await client.getTransactionReceipt({ hash: TX });
  console.log("=== Receipt ===");
  console.log("Status:", receipt.status);
  console.log("Gas used:", receipt.gasUsed?.toString());
  console.log("Block:", receipt.blockNumber?.toString());

  // Try to get revert reason by simulating the tx
  try {
    const tx = await client.getTransaction({ hash: TX });
    await client.call({
      ...tx,
      blockNumber: receipt.blockNumber,
    });
    console.log("Call succeeded (weird)");
  } catch (err) {
    console.log("\\n=== Revert Reason ===");
    console.log("Error:", err.message);
    if (err.data) console.log("Data:", err.data);
  }

  // Decode logs to find FailedOp event
  const failedOpAbi = parseAbi(["event FailedOp(uint256 opIndex, string reason)"],
    ["event AccountDeployed(address indexed sender, address indexed factory)"]
  );

  console.log("\\n=== Logs ===");
  for (const log of receipt.logs) {
    try {
      const decoded = decodeEventLog({
        abi: failedOpAbi,
        data: log.data,
        topics: log.topics,
      });
      console.log("Decoded event:", decoded.eventName, decoded.args);
    } catch (e) {
      // not our event
    }
  }
}

// Helper
function decodeEventLog({ abi, data, topics }) {
  const { createPublicClient, http } = require("viem");
  const { decodeEventLog: dl } = require("viem");
  return dl({ abi, data, topics });
}

main().catch(console.error);
