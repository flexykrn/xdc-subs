const { createPublicClient, http, parseAbi } = require("viem");

const RPC = "https://erpc.apothem.network";
const FACTORY = "0x91E60e0613810449d098b0b5Ec8b51A0FE8c8985";
const OWNER = "0x547bE814540ADdc6aBdAA4c378C5Cd77eb612cfb";

async function main() {
  const client = createPublicClient({ transport: http(RPC) });

  // Get address from factory
  const getAddrResult = await client.readContract({
    address: FACTORY,
    abi: parseAbi(["function getAddress(address owner, uint256 salt) view returns (address)"]),
    functionName: "getAddress",
    args: [OWNER, 0n],
  });
  console.log("getAddress(OWNER, 0):", getAddrResult);

  // Check if that address has code
  const code1 = await client.getBytecode({ address: getAddrResult });
  console.log("Code at getAddress result:", code1?.length || 0);

  // Try createAccount (read-only simulation)
  try {
    const createResult = await client.readContract({
      address: FACTORY,
      abi: parseAbi(["function createAccount(address owner, uint256 salt) returns (address)"]),
      functionName: "createAccount",
      args: [OWNER, 0n],
    });
    console.log("createAccount(OWNER, 0):", createResult);

    const code2 = await client.getBytecode({ address: createResult });
    console.log("Code at createAccount result:", code2?.length || 0);
  } catch(e) {
    console.log("createAccount call error:", e.message);
  }

  // Check 0x405Dc84304d848F7c2F7DF8d19957B3b49128b9a
  const altAddr = "0x405Dc84304d848F7c2F7DF8d19957B3b49128b9a";
  const code3 = await client.getBytecode({ address: altAddr });
  console.log("\nCode at 0x405Dc...:", code3?.length || 0);
}

main().catch(console.error);
