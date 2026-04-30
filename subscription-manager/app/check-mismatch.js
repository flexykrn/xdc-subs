const { createPublicClient, http, parseAbi } = require("viem");

const RPC = "https://erpc.apothem.network";
const FACTORY = "0x91E60e0613810449d098b0b5Ec8b51A0FE8c8985";
const SENDER = "0x6302F0b313374c604067e286C17354527F9692fD";
const INITCODE_OWNER = "0x547bE814540ADdc6aBdAA4c378C5Cd77eb612cfb";

async function main() {
  const client = createPublicClient({ transport: http(RPC) });

  // Check what getAddress returns for the initCode owner
  const expectedSender = await client.readContract({
    address: FACTORY,
    abi: parseAbi(["function getAddress(address owner, uint256 salt) view returns (address)"]),
    functionName: "getAddress",
    args: [INITCODE_OWNER, 0n],
  });
  console.log("Expected sender for initCode owner:", expectedSender);
  console.log("Actual sender:", SENDER);
  console.log("Match?", expectedSender.toLowerCase() === SENDER.toLowerCase() ? "YES" : "NO");

  // Check bytecode of both addresses
  const senderCode = await client.getBytecode({ address: SENDER });
  const ownerCode = await client.getBytecode({ address: INITCODE_OWNER });
  console.log("\nSender bytecode:", senderCode?.length || 0, senderCode === "0x" ? "(EOA)" : "(contract)");
  console.log("Owner bytecode:", ownerCode?.length || 0, ownerCode === "0x" ? "(EOA)" : "(contract)");

  // Check balances
  const senderBal = await client.getBalance({ address: SENDER });
  const ownerBal = await client.getBalance({ address: INITCODE_OWNER });
  console.log("\nSender balance:", Number(senderBal) / 1e18, "tXDC");
  console.log("Owner balance:", Number(ownerBal) / 1e18, "tXDC");
}

main().catch(console.error);
