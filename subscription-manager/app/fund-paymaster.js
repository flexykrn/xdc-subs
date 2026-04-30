const fs = require("fs");
const { createWalletClient, http, parseAbi } = require("viem");
const { privateKeyToAccount } = require("viem/accounts");

const RPC = "https://erpc.apothem.network";
const PAYMASTER = "0x8361Fae5A25e71C2E1db35cDE13E7150bB7b1a42";

// Read key from .env.local
const envContent = fs.readFileSync(".env.local", "utf8");
const keyMatch = envContent.match(/DEPLOYER_PRIVATE_KEY=(.+)/);
if (!keyMatch) {
  console.error("DEPLOYER_PRIVATE_KEY not found in .env.local");
  process.exit(1);
}
const KEY = keyMatch[1].trim();

const account = privateKeyToAccount(KEY);

const client = createWalletClient({
  account,
  transport: http(RPC),
});

const paymasterAbi = parseAbi([
  "function deposit() external payable",
  "function getDeposit() external view returns (uint256)",
  "receive() external payable",
]);

async function main() {
  const amount = BigInt(100) * BigInt(10 ** 18); // 100 tXDC

  console.log("Funding paymaster:", PAYMASTER);
  console.log("Amount:", "100 tXDC");
  console.log("From:", account.address);

  const hash = await client.writeContract({
    address: PAYMASTER,
    abi: paymasterAbi,
    functionName: "deposit",
    value: amount,
    chain: null,
    gas: 100000n,
  });

  console.log("Deposit tx hash:", hash);
  console.log("View: https://testnet.xdcscan.com/tx/" + hash);
}

main().catch(console.error);
