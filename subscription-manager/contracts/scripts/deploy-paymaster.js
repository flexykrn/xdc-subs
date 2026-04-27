const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying TokenGasPaymaster with account:", deployer.address);

  const TokenGasPaymaster = await hre.ethers.getContractFactory("TokenGasPaymaster");
  const paymaster = await TokenGasPaymaster.deploy();
  await paymaster.waitForDeployment();

  const address = await paymaster.getAddress();
  console.log("TokenGasPaymaster deployed to:", address);

  // Fund with 5 tXDC for gas sponsorship
  const fundTx = await deployer.sendTransaction({
    to: address,
    value: hre.ethers.parseEther("5"),
  });
  await fundTx.wait();
  console.log("Funded paymaster with 5 tXDC");

  // Add supported tokens with rates
  // Rate = how many token wei per 1 tXDC wei
  // All tokens have 18 decimals, so rate = 10 (1 tXDC = 10 tokens)
  const tokens = [
    { name: "Netflix",  address: "0x896F79883Bf0620Afcd3D8942f1Db8d3F447AE84", rate: hre.ethers.parseEther("10") },
    { name: "Spotify",  address: "0x9F00925759A9F0FEb13373336B761A7267AE66a9", rate: hre.ethers.parseEther("10") },
    { name: "YouTube",  address: "0x591CCebbd943a2F9a11F64eBf627d86600a0f38e", rate: hre.ethers.parseEther("10") },
    { name: "JioHotstar", address: "0x87CB2de7edc1B9D725a5a6DeDdcbEF7e36fe3084", rate: hre.ethers.parseEther("10") },
    { name: "Claude",   address: "0xA228078133e812677533166A44187c1Ae696687A", rate: hre.ethers.parseEther("10") },
    { name: "Copilot",  address: "0x4c4456bF7A0e572D2C697626025DcB6d3D3Df7D1", rate: hre.ethers.parseEther("10") },
  ];

  for (const t of tokens) {
    const tx = await paymaster.addToken(t.address, t.rate);
    await tx.wait();
    console.log(`Added ${t.name} token with rate ${t.rate}`);
  }

  console.log("\n=== Deployment Summary ===");
  console.log("Paymaster:", address);
  console.log("Funded: 5 tXDC");
  console.log("Tokens added:", tokens.length);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
