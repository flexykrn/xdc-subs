const { createPublicClient, http } = require("viem");

const RPC = "https://erpc.apothem.network";
const ADDR = "0xA9Dfd3F1F6e5728B1CE8975E0e5fef9634Bd0375";

async function main() {
  const client = createPublicClient({ transport: http(RPC) });

  console.log("Checking address:", ADDR);

  const code = await client.getBytecode({ address: ADDR });
  const balance = await client.getBalance({ address: ADDR });

  console.log("Has code?", code && code !== "0x" ? "YES (contract)" : "NO (EOA or empty)");
  console.log("Balance:", balance.toString(), "wei =", Number(balance) / 1e18, "tXDC");
  console.log("\nOur known addresses:");
  console.log("- VerifyingPaymaster:", "0x8361...1a42");
  console.log("- TokenGasPaymaster:", "0x12C8...5489");
  console.log("- Deployer/Bundler:", "0x8916...4375");
  console.log("- EntryPoint:", "0x0000...da032");
}

main().catch(console.error);
