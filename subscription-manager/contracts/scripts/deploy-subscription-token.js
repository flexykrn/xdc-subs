require("dotenv").config();

const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with:", deployer.address);
  console.log("Network:", hre.network.name);

  const SubscriptionToken = await hre.ethers.getContractFactory("SubscriptionToken");
  const token = await SubscriptionToken.deploy(deployer.address);
  await token.waitForDeployment();

  const address = await token.getAddress();
  console.log("SubscriptionToken deployed to:", address);
  console.log("Minter (deployer):", deployer.address);

  const fs = require("fs");
  fs.writeFileSync(
    "deployment-sub-token.json",
    JSON.stringify({ address, deployer: deployer.address, network: hre.network.name }, null, 2)
  );
  console.log("Saved to deployment-sub-token.json");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
