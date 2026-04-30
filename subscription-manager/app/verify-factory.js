const { createPublicClient, http, parseAbi } = require("viem");

const RPC = "https://erpc.apothem.network";
const FACTORY = "0x91E60e0613810449d098b0b5Ec8b51A0FE8c8985";
const ENTRYPOINT = "0x0000000071727De22E5E9d8BAf0edAc6f37da032";

// Example owner - replace with actual user's EOA
const OWNER = process.argv[2] || "0x8916DD1311c17aD008bB56bE3378E001a92e4375";

async function main() {
  const client = createPublicClient({ transport: http(RPC) });

  console.log("Checking factory:", FACTORY);
  console.log("Owner:", OWNER);

  // 1. Check factory bytecode
  const factoryCode = await client.getBytecode({ address: FACTORY });
  console.log("Factory bytecode length:", factoryCode?.length || 0);
  if (!factoryCode || factoryCode === "0x") {
    console.log("❌ FACTORY DOES NOT EXIST ON CHAIN!");
    process.exit(1);
  }

  // 2. Get counterfactual address
  const saAddress = await client.readContract({
    address: FACTORY,
    abi: parseAbi(["function getAddress(address owner, uint256 salt) view returns (address)"]),
    functionName: "getAddress",
    args: [OWNER, 0n],
  });
  console.log("Smart Account address:", saAddress);

  // 3. Check if SA already deployed
  const saCode = await client.getBytecode({ address: saAddress });
  console.log("SA bytecode length:", saCode?.length || 0);
  console.log("SA deployed?", saCode && saCode !== "0x" ? "✅ YES" : "❌ NO (needs initCode)");

  // 4. Check factory createAccount function
  try {
    const predicted = await client.readContract({
      address: FACTORY,
      abi: parseAbi(["function createAccount(address owner, uint256 salt) returns (address)"]),
      functionName: "createAccount",
      args: [OWNER, 0n],
    });
    console.log("Factory createAccount returned:", predicted);
  } catch (e) {
    console.log("createAccount call failed:", e.message);
  }
}

main().catch(console.error);
