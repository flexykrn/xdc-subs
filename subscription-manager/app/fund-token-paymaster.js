const { ethers } = require("ethers");

const ENTRYPOINT = "0x0000000071727De22E5E9d8BAf0edAc6f37da032";
const TOKEN_PAYMASTER = "0x12C8a71e89A482F8C5D22AAaE1e58b7Bb35a5489";
const RPC_URL = "https://erpc.apothem.network";

const ENTRYPOINT_ABI = [
  "function depositTo(address account) payable",
  "function balanceOf(address account) view returns (uint256)",
];

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  // Read key from .env.local (DO NOT hardcode in source)
  const fs = require("fs");
  const envPath = require("path").join(__dirname, ".env.local");
  const envContent = fs.readFileSync(envPath, "utf8");
  const keyMatch = envContent.match(/BUNDLER_PRIVATE_KEY=([a-fA-F0-9x]+)/);
  const deployerKey = keyMatch ? keyMatch[1] : null;
  if (!deployerKey) {
    console.error("No deployer key found in env");
    process.exit(1);
  }
  
  const wallet = new ethers.Wallet(deployerKey, provider);
  const entryPoint = new ethers.Contract(ENTRYPOINT, ENTRYPOINT_ABI, wallet);

  const balanceBefore = await entryPoint.balanceOf(TOKEN_PAYMASTER);
  console.log("Before:", ethers.formatEther(balanceBefore), "tXDC");

  // Deposit 3 tXDC to TokenGasPaymaster
  const tx = await entryPoint.depositTo(TOKEN_PAYMASTER, { value: ethers.parseEther("3") });
  console.log("Deposit tx:", tx.hash);
  await tx.wait();

  const balanceAfter = await entryPoint.balanceOf(TOKEN_PAYMASTER);
  console.log("After:", ethers.formatEther(balanceAfter), "tXDC");
}

main().catch(console.error);
