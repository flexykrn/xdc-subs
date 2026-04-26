const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const owner = deployer.address;
  const treasury = deployer.address;
  const monthlyInterval = 30 * 24 * 60 * 60;

  console.log("Deploying with account:", owner);

  // Deploy 6 service tokens
  console.log("\n=== Deploying Service Tokens ===");

  const netflixToken = await hre.ethers.deployContract("NetflixToken", [owner]);
  await netflixToken.waitForDeployment();
  console.log("NetflixToken (NFX):", await netflixToken.getAddress());

  const spotifyToken = await hre.ethers.deployContract("SpotifyToken", [owner]);
  await spotifyToken.waitForDeployment();
  console.log("SpotifyToken (SPF):", await spotifyToken.getAddress());

  const youtubeToken = await hre.ethers.deployContract("YouTubeToken", [owner]);
  await youtubeToken.waitForDeployment();
  console.log("YouTubeToken (YTB):", await youtubeToken.getAddress());

  const jiohotstarToken = await hre.ethers.deployContract("JioHotstarToken", [owner]);
  await jiohotstarToken.waitForDeployment();
  console.log("JioHotstarToken (JHS):", await jiohotstarToken.getAddress());

  const claudeToken = await hre.ethers.deployContract("ClaudeToken", [owner]);
  await claudeToken.waitForDeployment();
  console.log("ClaudeToken (CLA):", await claudeToken.getAddress());

  const copilotToken = await hre.ethers.deployContract("CopilotToken", [owner]);
  await copilotToken.waitForDeployment();
  console.log("CopilotToken (COP):", await copilotToken.getAddress());

  // Deploy SubscriptionManager
  console.log("\n=== Deploying SubscriptionManager ===");
  const subscriptionManager = await hre.ethers.deployContract("SubscriptionManager", [owner, treasury]);
  await subscriptionManager.waitForDeployment();
  console.log("SubscriptionManager:", await subscriptionManager.getAddress());

  const nfx = await netflixToken.getAddress();
  const spf = await spotifyToken.getAddress();
  const ytb = await youtubeToken.getAddress();
  const jhs = await jiohotstarToken.getAddress();
  const cla = await claudeToken.getAddress();
  const cop = await copilotToken.getAddress();
  const sm = await subscriptionManager.getAddress();

  // Create 15 plans (one per tier per service)
  console.log("\n=== Creating Plans ===");
  const plans = [
    // Netflix (planIds 1-3)
    { planId: 1, price: hre.ethers.parseEther("5"), interval: monthlyInterval, tokenAddress: nfx, service: "Netflix", tier: "Mobile" },
    { planId: 2, price: hre.ethers.parseEther("10"), interval: monthlyInterval, tokenAddress: nfx, service: "Netflix", tier: "Basic" },
    { planId: 3, price: hre.ethers.parseEther("20"), interval: monthlyInterval, tokenAddress: nfx, service: "Netflix", tier: "Standard" },
    // Spotify (planIds 4-6)
    { planId: 4, price: hre.ethers.parseEther("1"), interval: 7 * 24 * 60 * 60, tokenAddress: spf, service: "Spotify", tier: "Mini" },
    { planId: 5, price: hre.ethers.parseEther("8"), interval: monthlyInterval, tokenAddress: spf, service: "Spotify", tier: "Individual" },
    { planId: 6, price: hre.ethers.parseEther("15"), interval: monthlyInterval, tokenAddress: spf, service: "Spotify", tier: "Family" },
    // YouTube (planIds 7-8)
    { planId: 7, price: hre.ethers.parseEther("7"), interval: monthlyInterval, tokenAddress: ytb, service: "YouTube", tier: "Individual" },
    { planId: 8, price: hre.ethers.parseEther("13"), interval: monthlyInterval, tokenAddress: ytb, service: "YouTube", tier: "Family" },
    // JioHotstar (planIds 9-11)
    { planId: 9, price: hre.ethers.parseEther("3"), interval: monthlyInterval, tokenAddress: jhs, service: "JioHotstar", tier: "Mobile" },
    { planId: 10, price: hre.ethers.parseEther("6"), interval: monthlyInterval, tokenAddress: jhs, service: "JioHotstar", tier: "Super" },
    { planId: 11, price: hre.ethers.parseEther("12"), interval: monthlyInterval, tokenAddress: jhs, service: "JioHotstar", tier: "Premium" },
    // Claude (planIds 12-13)
    { planId: 12, price: hre.ethers.parseEther("25"), interval: monthlyInterval, tokenAddress: cla, service: "Claude", tier: "Pro" },
    { planId: 13, price: hre.ethers.parseEther("35"), interval: monthlyInterval, tokenAddress: cla, service: "Claude", tier: "Team" },
    // Copilot (planIds 14-15)
    { planId: 14, price: hre.ethers.parseEther("12"), interval: monthlyInterval, tokenAddress: cop, service: "Copilot", tier: "Individual" },
    { planId: 15, price: hre.ethers.parseEther("22"), interval: monthlyInterval, tokenAddress: cop, service: "Copilot", tier: "Business" },
  ];

  for (const plan of plans) {
    const tx = await subscriptionManager.createPlan(plan.planId, plan.price, plan.interval, plan.tokenAddress);
    await tx.wait();
    console.log(`Plan ${plan.planId}: ${plan.service} ${plan.tier} — ${hre.ethers.formatEther(plan.price)} tokens / ${plan.interval / (24 * 60 * 60)} days`);
  }

  const network = await hre.ethers.provider.getNetwork();

  const deployment = {
    network: hre.network.name,
    chainId: Number(network.chainId),
    deployer: owner,
    subscriptionManager: sm,
    tokens: {
      netflix: nfx,
      spotify: spf,
      youtube: ytb,
      jiohotstar: jhs,
      claude: cla,
      copilot: cop,
    },
    plans: plans.map((plan) => ({
      planId: plan.planId,
      price: plan.price.toString(),
      interval: plan.interval,
      tokenAddress: plan.tokenAddress,
      service: plan.service,
      tier: plan.tier,
    })),
    deployedAt: new Date().toISOString(),
  };

  const outputPath = path.join(__dirname, "..", "deployment.json");
  fs.writeFileSync(outputPath, JSON.stringify(deployment, null, 2));

  console.log("\n=== Deployment Complete ===");
  console.table({
    "NetflixToken (NFX)": nfx,
    "SpotifyToken (SPF)": spf,
    "YouTubeToken (YTB)": ytb,
    "JioHotstarToken (JHS)": jhs,
    "ClaudeToken (CLA)": cla,
    "CopilotToken (COP)": cop,
    "SubscriptionManager": sm,
  });
  console.log("Saved to:", outputPath);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
