const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

const ENTRY_POINT_V07 = "0x0000000071727De22E5E9d8BAf0edAc6f37da032";

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying VerifyingSponsorPaymaster with account:", deployer.address);

  const VerifyingSponsorPaymaster = await hre.ethers.getContractFactory("VerifyingSponsorPaymaster");
  const paymaster = await VerifyingSponsorPaymaster.deploy(ENTRY_POINT_V07, deployer.address);
  await paymaster.waitForDeployment();

  const paymasterAddress = await paymaster.getAddress();
  console.log("VerifyingSponsorPaymaster deployed to:", paymasterAddress);

  // Fund the paymaster with 2 XDC for gas sponsorship
  console.log("Funding paymaster with 2 XDC...");
  const depositTx = await paymaster.deposit({ value: hre.ethers.parseEther("2") });
  await depositTx.wait();
  console.log("Paymaster funded. Deposit:", await paymaster.getDeposit());

  // Update deployment.json
  const deploymentPath = path.join(__dirname, "..", "deployment.json");
  let deployment = {};
  if (fs.existsSync(deploymentPath)) {
    deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  }

  deployment.apothem = deployment.apothem || {};
  deployment.apothem.paymaster = paymasterAddress;
  deployment.apothem.entryPoint = ENTRY_POINT_V07;
  deployment.apothem.paymasterOwner = deployer.address;

  fs.writeFileSync(deploymentPath, JSON.stringify(deployment, null, 2));
  console.log("Updated deployment.json");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
