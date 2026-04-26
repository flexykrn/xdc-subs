const hre = require("hardhat");

async function main() {
  const recipient = process.env.MINT_RECIPIENT || "";
  const token = (process.env.MINT_TOKEN || "A").toUpperCase();
  const amountValue = process.env.MINT_AMOUNT || "1000";

  if (!recipient) {
    throw new Error("Missing MINT_RECIPIENT env variable");
  }

  const amount = hre.ethers.parseEther(amountValue);
  const contractName = token === "B" ? "TestTokenB" : "TestTokenA";
  const deployment = require("../deployment.json");
  const tokenAddress = token === "B" ? deployment.tokenB : deployment.tokenA;

  const [owner] = await hre.ethers.getSigners();
  const contract = await hre.ethers.getContractAt(contractName, tokenAddress, owner);

  const tx = await contract.faucetMint(recipient, amount);
  await tx.wait();

  console.log(`Minted ${amountValue} ${contractName} tokens to ${recipient}`);
  console.log(`Token address: ${tokenAddress}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
