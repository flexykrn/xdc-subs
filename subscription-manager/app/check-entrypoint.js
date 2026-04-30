const { createPublicClient, http, parseAbi } = require("viem");

const RPC = "https://erpc.apothem.network";
const PAYMASTER = "0x8361Fae5A25e71C2E1db35cDE13E7150bB7b1a42";
const OUR_ENTRYPOINT = "0x0000000071727De22E5E9d8BAf0edAc6f37da032";

async function main() {
  const client = createPublicClient({ transport: http(RPC) });

  // Check what EntryPoint the paymaster uses
  const entryPointAddr = await client.readContract({
    address: PAYMASTER,
    abi: parseAbi(["function entryPoint() view returns (address)"]),
    functionName: "entryPoint",
  });

  console.log("Paymaster's EntryPoint:", entryPointAddr);
  console.log("Our EntryPoint:", OUR_ENTRYPOINT);
  console.log("Match?", entryPointAddr.toLowerCase() === OUR_ENTRYPOINT.toLowerCase() ? "YES" : "NO");

  // Check deposit on the paymaster's EntryPoint
  const deposit = await client.readContract({
    address: entryPointAddr,
    abi: parseAbi(["function getDepositInfo(address account) view returns (uint112 deposit, bool staked, uint112 stake, uint32 unstakeDelaySec, uint48 withdrawTime)"]),
    functionName: "getDepositInfo",
    args: [PAYMASTER],
  });

  console.log("\nDeposit on paymaster's EntryPoint:", Number(deposit[0]) / 1e18, "tXDC");
  console.log("Staked?", deposit[1]);

  // Check deposit on OUR EntryPoint
  try {
    const ourDeposit = await client.readContract({
      address: OUR_ENTRYPOINT,
      abi: parseAbi(["function getDepositInfo(address account) view returns (uint112 deposit, bool staked, uint112 stake, uint32 unstakeDelaySec, uint48 withdrawTime)"]),
      functionName: "getDepositInfo",
      args: [PAYMASTER],
    });
    console.log("Deposit on our EntryPoint:", Number(ourDeposit[0]) / 1e18, "tXDC");
  } catch (e) {
    console.log("Could not read from our EntryPoint:", e.message);
  }
}

main().catch(console.error);
