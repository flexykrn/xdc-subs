const { createPublicClient, http, parseAbi } = require("viem");

const RPC = "https://erpc.apothem.network";
const ENTRYPOINT = "0x0000000071727De22E5E9d8BAf0edAc6f37da032";
const PAYMASTER = "0x8361Fae5A25e71C2E1db35cDE13E7150bB7b1a42";

async function main() {
  const client = createPublicClient({ transport: http(RPC) });

  console.log("=== Paymaster Status ===\n");

  // Check EntryPoint deposit for paymaster
  const deposit = await client.readContract({
    address: ENTRYPOINT,
    abi: parseAbi(["function getDepositInfo(address account) view returns (uint112 deposit, bool staked, uint112 stake, uint32 unstakeDelaySec, uint48 withdrawTime)"]),
    functionName: "getDepositInfo",
    args: [PAYMASTER],
  });

  console.log("VerifyingPaymaster:", PAYMASTER);
  console.log("EntryPoint deposit:", Number(deposit[0]) / 1e18, "tXDC");
  console.log("Staked?", deposit[1]);
  console.log("\n");

  // Check paymaster's own native balance
  const balance = await client.getBalance({ address: PAYMASTER });
  console.log("Paymaster native balance:", Number(balance) / 1e18, "tXDC");

  // Check if paymaster is a contract
  const code = await client.getBytecode({ address: PAYMASTER });
  console.log("Is contract?", code && code !== "0x" ? "YES" : "NO");
}

main().catch(console.error);
