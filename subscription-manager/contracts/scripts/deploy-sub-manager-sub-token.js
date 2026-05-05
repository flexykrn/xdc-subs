const hre = require("hardhat");
require("dotenv").config();

const SUB_TOKEN_ADDRESS = process.env.NEXT_PUBLIC_SUB_TOKEN_ADDRESS || "0xA555BEf79D024F1776C05A09739943eB6aaA96Af";

const PLANS = [
  // Netflix
  { planId: 1, price: hre.ethers.parseEther("5"), interval: 2592000, service: "Netflix", tier: "Mobile" },
  { planId: 2, price: hre.ethers.parseEther("10"), interval: 2592000, service: "Netflix", tier: "Basic" },
  { planId: 3, price: hre.ethers.parseEther("20"), interval: 2592000, service: "Netflix", tier: "Standard" },
  // Spotify
  { planId: 4, price: hre.ethers.parseEther("1"), interval: 604800, service: "Spotify", tier: "Mini" },
  { planId: 5, price: hre.ethers.parseEther("8"), interval: 2592000, service: "Spotify", tier: "Individual" },
  { planId: 6, price: hre.ethers.parseEther("15"), interval: 2592000, service: "Spotify", tier: "Family" },
  // YouTube
  { planId: 7, price: hre.ethers.parseEther("7"), interval: 2592000, service: "YouTube", tier: "Individual" },
  { planId: 8, price: hre.ethers.parseEther("13"), interval: 2592000, service: "YouTube", tier: "Family" },
  // JioHotstar
  { planId: 9, price: hre.ethers.parseEther("3"), interval: 2592000, service: "JioHotstar", tier: "Mobile" },
  { planId: 10, price: hre.ethers.parseEther("6"), interval: 2592000, service: "JioHotstar", tier: "Super" },
  { planId: 11, price: hre.ethers.parseEther("12"), interval: 2592000, service: "JioHotstar", tier: "Premium" },
  // Claude
  { planId: 12, price: hre.ethers.parseEther("25"), interval: 2592000, service: "Claude", tier: "Pro" },
  { planId: 13, price: hre.ethers.parseEther("35"), interval: 2592000, service: "Claude", tier: "Team" },
  { planId: 16, price: hre.ethers.parseEther("50"), interval: 2592000, service: "Claude", tier: "Enterprise" },
  // Copilot
  { planId: 14, price: hre.ethers.parseEther("12"), interval: 2592000, service: "Copilot", tier: "Individual" },
  { planId: 15, price: hre.ethers.parseEther("22"), interval: 2592000, service: "Copilot", tier: "Business" },
  { planId: 17, price: hre.ethers.parseEther("35"), interval: 2592000, service: "Copilot", tier: "Enterprise" },
];

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with:", deployer.address);
  console.log("SUB Token:", SUB_TOKEN_ADDRESS);

  // Check deployer balance
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Deployer balance:", hre.ethers.formatEther(balance), "tXDC");

  if (balance === 0n) {
    console.error("❌ Deployer has 0 tXDC. Fund from faucet first.");
    process.exit(1);
  }

  // Deploy
  const factory = await hre.ethers.getContractFactory("SubscriptionManager");
  const manager = await factory.deploy(deployer.address, deployer.address);
  await manager.waitForDeployment();

  const address = await manager.getAddress();
  console.log("\n✅ SubscriptionManager deployed:", address);

  // Create all plans with SUB token
  console.log("\nCreating plans...");
  for (const plan of PLANS) {
    try {
      const tx = await manager.createPlan(
        plan.planId,
        plan.price,
        plan.interval,
        SUB_TOKEN_ADDRESS
      );
      await tx.wait();
      console.log(`✅ Plan ${plan.planId}: ${plan.service} ${plan.tier} - ${hre.ethers.formatEther(plan.price)} SUB`);
    } catch (err) {
      console.error(`❌ Plan ${plan.planId} failed:`, err.message);
    }
  }

  // Save deployment info
  const fs = require("fs");
  const deployment = {
    network: "apothem",
    chainId: 51,
    deployer: deployer.address,
    subscriptionManager: address,
    subToken: SUB_TOKEN_ADDRESS,
    plans: PLANS.map(p => ({
      planId: p.planId,
      price: p.price.toString(),
      interval: p.interval,
      tokenAddress: SUB_TOKEN_ADDRESS,
      service: p.service,
      tier: p.tier
    })),
    deployedAt: new Date().toISOString()
  };

  fs.writeFileSync("deployment-sub-manager.json", JSON.stringify(deployment, null, 2));
  console.log("\n📄 Saved to deployment-sub-manager.json");
  console.log("\n⚠️  IMPORTANT: Update .env.local with:");
  console.log(`NEXT_PUBLIC_SUBSCRIPTION_MANAGER_ADDRESS=${address}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
