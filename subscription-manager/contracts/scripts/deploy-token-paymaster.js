const hre = require("hardhat");

const ENTRYPOINT = "0x0000000071727De22E5E9d8BAf0edAc6f37da032";
const TOKENS = {
  netflix: "0x27Eb0dc3B1C7c7079DBD8E5C9C6B5B29dDb746e6",
  spotify: "0xC7F1e2B5a438507373eE7e4e6128E4C9fF56E27",
  youtube: "0x9D8B2363B52263A9165452Fa003F56Fdc7B5a82b",
  jiohotstar: "0x1Cdd1B29e7B4fE4AD91D9b9023F5c75bF4C3fA9D",
  claude: "0xE824F843c1c6F1C9D9e4F2A1b7D3c8A5E0F2B4C6",
  copilot: "0x4A6B8C3D5E1F7A2B9C0D4E8F3A5B7C1D6E0F2A4B",
};

// Rate: 1000 tokens per 1 tXDC (for testnet)
const TOKEN_RATE = 1000n * 10n**18n;

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deployer:", deployer.address);
  
  // Deploy TokenPaymaster
  console.log("Deploying TokenPaymaster...");
  const TokenPaymaster = await hre.ethers.getContractFactory("TokenPaymaster");
  const paymaster = await TokenPaymaster.deploy(ENTRYPOINT);
  await paymaster.waitForDeployment();
  
  const address = await paymaster.getAddress();
  console.log("TokenPaymaster deployed to:", address);
  
  // Add supported tokens
  console.log("Adding tokens...");
  for (const [name, token] of Object.entries(TOKENS)) {
    const tx = await paymaster.addToken(token, TOKEN_RATE);
    await tx.wait();
    console.log(`  Added ${name}: ${token}`);
  }
  
  // Deposit to EntryPoint (fund with 5 tXDC)
  console.log("Depositing 5 tXDC to EntryPoint...");
  const depositTx = await paymaster.depositToEntryPoint({ value: hre.ethers.parseEther("5") });
  await depositTx.wait();
  console.log("Deposited");
  
  // Add stake (required for paymaster)
  console.log("Adding stake...");
  const stakeTx = await paymaster.addStake(86400, { value: hre.ethers.parseEther("1") }); // 1 day unstake delay
  await stakeTx.wait();
  console.log("Staked");
  
  console.log("\n=== DEPLOYMENT COMPLETE ===");
  console.log("TokenPaymaster:", address);
  console.log("EntryPoint deposit: 5 tXDC");
  console.log("Stake: 1 tXDC");
  
  // Save to deployment.json
  const fs = require("fs");
  const path = require("path");
  const deploymentPath = path.join(__dirname, "..", "deployment.json");
  
  let deployment = {};
  if (fs.existsSync(deploymentPath)) {
    deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  }
  
  deployment.tokenPaymaster = address;
  deployment.tokenPaymasterTokens = Object.values(TOKENS);
  
  fs.writeFileSync(deploymentPath, JSON.stringify(deployment, null, 2));
  console.log("Updated deployment.json");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
