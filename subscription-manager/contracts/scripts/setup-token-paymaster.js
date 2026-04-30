const hre = require("hardhat");

const ENTRYPOINT = "0x0000000071727De22E5E9d8BAf0edAc6f37da032";
const PAYMASTER = "0x17D390EdEb894d8c8B5cD5e6fD47Db923CB4A2c4";

const TOKENS = [
  "0x896F79883Bf0620Afcd3D8942f1Db8d3F447AE84", // Netflix
  "0x9F00925759A9F0FEb13373336B761A7267AE66a9", // Spotify
  "0x591CCebbd943a2F9a11F64eBf627d86600a0f38e", // YouTube
  "0x87CB2de7edc1B9D725a5a6DeDdcbEF7e36fe3084", // JioHotstar
  "0xA228078133e812677533166A44187c1Ae696687A", // Claude
  "0x4c4456bF7A0e572D2C697626025DcB6d3D3Df7D1", // Copilot
];

// Rate: 1000 token wei per 1 tXDC wei
const TOKEN_RATE = 1000n * 10n**18n;

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deployer:", deployer.address);
  
  const paymaster = await hre.ethers.getContractAt("TokenPaymaster", PAYMASTER);
  
  // Add supported tokens
  console.log("Adding tokens...");
  for (const token of TOKENS) {
    const tx = await paymaster.addToken(token, TOKEN_RATE);
    await tx.wait();
    console.log(`  Added: ${token}`);
  }
  
  // Deposit to EntryPoint (fund with 5 tXDC)
  console.log("Depositing 5 tXDC to EntryPoint...");
  const depositTx = await paymaster.depositToEntryPoint({ value: hre.ethers.parseEther("5") });
  await depositTx.wait();
  console.log("Deposited");
  
  // Add stake (required for paymaster)
  console.log("Adding stake...");
  const stakeTx = await paymaster.addStake(86400, { value: hre.ethers.parseEther("1") });
  await stakeTx.wait();
  console.log("Staked");
  
  console.log("\n=== SETUP COMPLETE ===");
  console.log("TokenPaymaster:", PAYMASTER);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
