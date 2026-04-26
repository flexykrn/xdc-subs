// Add additional plans to existing SubscriptionManager
const hre = require("hardhat");

async function main() {
  const [owner] = await hre.ethers.getSigners();
  
  // Existing contract address
  const SUBSCRIPTION_MANAGER = "0xe8271C9Bc2255A41cd2AB53FbfB69CE4B5f3032E";
  
  const manager = await hre.ethers.getContractAt("SubscriptionManager", SUBSCRIPTION_MANAGER, owner);
  
  const monthlyInterval = 30 * 24 * 60 * 60;
  
  // New plan IDs 16-17 (Claude Enterprise, Copilot Enterprise)
  const newPlans = [
    {
      planId: 16,
      price: hre.ethers.parseEther("50"),
      interval: monthlyInterval,
      tokenAddress: "0xA228078133e812677533166A44187c1Ae696687A",
      service: "Claude",
      tier: "Enterprise",
    },
    {
      planId: 17,
      price: hre.ethers.parseEther("35"),
      interval: monthlyInterval,
      tokenAddress: "0x4c4456bF7A0e572D2C697626025DcB6d3D3Df7D1",
      service: "Copilot",
      tier: "Enterprise",
    },
  ];

  for (const plan of newPlans) {
    try {
      const tx = await manager.createPlan(plan.planId, plan.price, plan.interval, plan.tokenAddress);
      await tx.wait();
      console.log(`Created plan ${plan.planId}: ${plan.service} ${plan.tier} - ${hre.ethers.formatEther(plan.price)} tokens`);
    } catch (err) {
      console.error(`Failed to create plan ${plan.planId}:`, err.message);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
