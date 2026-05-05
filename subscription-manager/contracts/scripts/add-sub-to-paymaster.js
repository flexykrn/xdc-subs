const hre = require("hardhat");
require("dotenv").config();

const TOKEN_PAYMASTER_ADDRESS = "0x17D390EdEb894d8c8B5cD5e6fD47Db923CB4A2c4";
const SUB_TOKEN_ADDRESS = process.env.NEXT_PUBLIC_SUB_TOKEN_ADDRESS || "0xA555BEf79D024F1776C05A09739943eB6aaA96Af";

// Rate: how many SUB wei per 1 tXDC wei
// Example: 1 tXDC = 1000 SUB → rate = 1000 * 10^18
// But we want a reasonable rate for testnet. Let's say 1 tXDC ≈ 0.1 SUB (very cheap gas)
// Rate = 0.1 * 10^18 = 10^17
const RATE = hre.ethers.parseEther("0.1"); // 0.1 SUB per 1 tXDC wei

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Adding token with:", deployer.address);

  const paymaster = await hre.ethers.getContractAt("TokenPaymaster", TOKEN_PAYMASTER_ADDRESS);

  // Check if already supported
  const isSupported = await paymaster.supportedTokens(SUB_TOKEN_ADDRESS);
  if (isSupported) {
    console.log("SUB token already supported. Updating rate...");
    const tx = await paymaster.updateRate(SUB_TOKEN_ADDRESS, RATE);
    await tx.wait();
    console.log("✅ Rate updated");
    return;
  }

  console.log("Adding SUB token to paymaster...");
  const tx = await paymaster.addToken(SUB_TOKEN_ADDRESS, RATE);
  await tx.wait();
  console.log("✅ SUB token added to paymaster");

  // Verify
  const supported = await paymaster.supportedTokens(SUB_TOKEN_ADDRESS);
  const rate = await paymaster.tokenRates(SUB_TOKEN_ADDRESS);
  console.log(`Supported: ${supported}, Rate: ${hre.ethers.formatEther(rate)} SUB per 1 tXDC wei`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
