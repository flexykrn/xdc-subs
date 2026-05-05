const hre = require("hardhat");
require("dotenv").config();

const SUB_TOKEN_ADDRESS = process.env.NEXT_PUBLIC_SUB_TOKEN_ADDRESS || "0xA555BEf79D024F1776C05A09739943eB6aaA96Af";
const MANAGER_ADDRESS = process.env.NEXT_PUBLIC_SUBSCRIPTION_MANAGER_ADDRESS || "0xe8271C9Bc2255A41cd2AB53FbfB69CE4B5f3032E";

const PLAN_IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17];

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Updating plans with:", deployer.address);
  console.log("Manager:", MANAGER_ADDRESS);
  console.log("SUB Token:", SUB_TOKEN_ADDRESS);

  const manager = await hre.ethers.getContractAt("SubscriptionManager", MANAGER_ADDRESS);

  for (const planId of PLAN_IDS) {
    try {
      const plan = await manager.plans(planId);
      if (!plan.active) {
        console.log(`Plan ${planId} not active, skipping`);
        continue;
      }

      console.log(`Plan ${planId}: current token=${plan.tokenAddress}`);
      
      const tx = await manager.updatePlanToken(planId, SUB_TOKEN_ADDRESS);
      await tx.wait();
      console.log(`✅ Plan ${planId} updated to SUB token`);
    } catch (err) {
      console.error(`❌ Plan ${planId} failed:`, err.message);
    }
  }

  console.log("\nDone! All plans now use SUB token:", SUB_TOKEN_ADDRESS);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
