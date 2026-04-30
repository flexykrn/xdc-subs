const hre = require("hardhat");

const ENTRYPOINT = "0x0000000071727De22E5E9d8BAf0edAc6f37da032";
const TOKEN_PAYMASTER = "0x17D390EdEb894d8c8B5cD5e6fD47Db923CB4A2c4";
const SA = "0x6302F0b313374c604067e286C17354527F9692fD";

// YouTube token
const TOKEN = "0x591CCebbd943a2F9a11F64eBf627d86600a0f38e";

async function main() {
  const provider = new hre.ethers.JsonRpcProvider("https://erpc.apothem.network");
  
  // Check TokenPaymaster deposit in EntryPoint
  const entryPoint = new hre.ethers.Contract(ENTRYPOINT, [
    "function balanceOf(address account) view returns (uint256)",
    "function getDepositInfo(address account) view returns (uint256 deposit, bool staked, uint112 stake, uint32 unstakeDelaySec, uint64 withdrawTimeSec)"
  ], provider);
  
  const balance = await entryPoint.balanceOf(TOKEN_PAYMASTER);
  console.log("TokenPaymaster EntryPoint balance:", hre.ethers.formatEther(balance), "tXDC");
  
  const info = await entryPoint.getDepositInfo(TOKEN_PAYMASTER);
  console.log("Deposit info:", {
    deposit: hre.ethers.formatEther(info.deposit),
    staked: info.staked,
    stake: hre.ethers.formatEther(info.stake),
  });
  
  // Check TokenPaymaster token support
  const paymaster = new hre.ethers.Contract(TOKEN_PAYMASTER, [
    "function supportedTokens(address) view returns (bool)",
    "function tokenRates(address) view returns (uint256)"
  ], provider);
  
  const isSupported = await paymaster.supportedTokens(TOKEN);
  const rate = await paymaster.tokenRates(TOKEN);
  console.log("Token supported:", isSupported);
  console.log("Token rate:", rate.toString());
  
  // Check SA token balance and allowance
  const token = new hre.ethers.Contract(TOKEN, [
    "function balanceOf(address) view returns (uint256)",
    "function allowance(address,address) view returns (uint256)"
  ], provider);
  
  const bal = await token.balanceOf(SA);
  const allowance = await token.allowance(SA, TOKEN_PAYMASTER);
  console.log("SA token balance:", hre.ethers.formatEther(bal));
  console.log("SA allowance to paymaster:", hre.ethers.formatEther(allowance));
}

main().catch(console.error);
