const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const owner = deployer.address;
  const treasury = deployer.address;
  const monthlyInterval = 30 * 24 * 60 * 60;

  console.log("Deploying with account:", owner);

  const tokenA = await hre.ethers.deployContract("TestTokenA", [owner]);
  await tokenA.waitForDeployment();

  const tokenB = await hre.ethers.deployContract("TestTokenB", [owner]);
  await tokenB.waitForDeployment();

  const subscriptionManager = await hre.ethers.deployContract("SubscriptionManager", [owner, treasury]);
  await subscriptionManager.waitForDeployment();

  const subscriptionManagerAddress = await subscriptionManager.getAddress();
  const tokenAAddress = await tokenA.getAddress();
  const tokenBAddress = await tokenB.getAddress();

  const seededPlans = [
    { planId: 1, price: hre.ethers.parseEther("10"), interval: monthlyInterval, tokenAddress: tokenAAddress },
    { planId: 2, price: hre.ethers.parseEther("25"), interval: monthlyInterval, tokenAddress: tokenAAddress },
    { planId: 3, price: hre.ethers.parseEther("40"), interval: monthlyInterval, tokenAddress: tokenBAddress },
  ];

  for (const plan of seededPlans) {
    const tx = await subscriptionManager.createPlan(plan.planId, plan.price, plan.interval, plan.tokenAddress);
    await tx.wait();
    console.log(`Seeded plan ${plan.planId}`);
  }

  const network = await hre.ethers.provider.getNetwork();

  const deployment = {
    network: hre.network.name,
    chainId: Number(network.chainId),
    deployer: owner,
    subscriptionManager: subscriptionManagerAddress,
    tokenA: tokenAAddress,
    tokenB: tokenBAddress,
    plans: seededPlans.map((plan) => ({
      planId: plan.planId,
      price: plan.price.toString(),
      interval: plan.interval,
      tokenAddress: plan.tokenAddress,
    })),
    deployedAt: new Date().toISOString(),
  };

  const outputPath = path.join(__dirname, "..", "deployment.json");
  fs.writeFileSync(outputPath, JSON.stringify(deployment, null, 2));

  console.log("Deployment complete:");
  console.table(deployment);
  console.log("Saved deployment details to:", outputPath);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
