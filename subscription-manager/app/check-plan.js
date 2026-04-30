const { createPublicClient, http, parseAbi } = require("viem");

const RPC = "https://erpc.apothem.network";
const SUBMAN = "0xe8271C9Bc2255A41cd2AB53FbfB69CE4B5f3032E";
const SA = "0x6302F0b313374c604067e286C17354527F9692fD";

async function main() {
  const client = createPublicClient({ transport: http(RPC) });
  
  // Check plan 4
  try {
    const plan = await client.readContract({
      address: SUBMAN,
      abi: parseAbi(["function plans(uint256) view returns (uint256 price, uint256 interval, address tokenAddress, bool active)"]),
      functionName: "plans",
      args: [4n],
    });
    console.log("Plan 4:", plan);
  } catch(e) {
    console.log("plans(4) error:", e.message);
  }
  
  // Check if user already has subscription for plan 4
  try {
    // Try different function names
    const count = await client.readContract({
      address: SUBMAN,
      abi: parseAbi(["function subscriptionCount() view returns (uint256)"]),
      functionName: "subscriptionCount",
    });
    console.log("Total subscriptions:", count.toString());
  } catch(e) {
    console.log("subscriptionCount error:", e.message);
  }
  
  // Check owner
  try {
    const owner = await client.readContract({
      address: SUBMAN,
      abi: parseAbi(["function owner() view returns (address)"]),
      functionName: "owner",
    });
    console.log("Owner:", owner);
  } catch(e) {
    console.log("owner error:", e.message);
  }
  
  // Check treasury
  try {
    const treasury = await client.readContract({
      address: SUBMAN,
      abi: parseAbi(["function treasury() view returns (address)"]),
      functionName: "treasury",
    });
    console.log("Treasury:", treasury);
  } catch(e) {
    console.log("treasury error:", e.message);
  }
  
  // Check token for plan 4
  const SPOTIFY = "0x9F00925759A9F0FEb13373336B761A7267AE66a9";
  
  // Check SA balance of Spotify
  const bal = await client.readContract({
    address: SPOTIFY,
    abi: parseAbi(["function balanceOf(address) view returns (uint256)"]),
    functionName: "balanceOf",
    args: [SA],
  });
  console.log("\nSA Spotify balance:", Number(bal) / 1e18);
  
  // Check allowance
  const allowance = await client.readContract({
    address: SPOTIFY,
    abi: parseAbi(["function allowance(address owner, address spender) view returns (uint256)"]),
    functionName: "allowance",
    args: [SA, SUBMAN],
  });
  console.log("SA allowance to SubMan:", Number(allowance) / 1e18);
}

main().catch(console.error);
