const { ethers } = require("ethers");

const ENTRYPOINT = "0x0000000071727De22E5E9d8BAf0edAc6f37da032";
const TOKEN_PAYMASTER = "0x12C8a71e89A482F8C5D22AAaE1e58b7Bb35a5489";
const RPC_URL = "https://erpc.apothem.network";

const ENTRYPOINT_ABI = [
  "function getDepositInfo(address account) view returns (uint256 deposit, bool staked, uint112 stake, uint32 unstakeDelaySec, uint64 withdrawTimeSec)",
  "function balanceOf(address account) view returns (uint256)",
  "function depositTo(address account) payable",
];

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const entryPoint = new ethers.Contract(ENTRYPOINT, ENTRYPOINT_ABI, provider);

  const balance = await entryPoint.balanceOf(TOKEN_PAYMASTER);
  console.log("TokenGasPaymaster EntryPoint balance:", ethers.formatEther(balance), "tXDC");

  const info = await entryPoint.getDepositInfo(TOKEN_PAYMASTER);
  console.log("Deposit info:", {
    deposit: ethers.formatEther(info.deposit),
    staked: info.staked,
    stake: ethers.formatEther(info.stake),
  });
}

main().catch(console.error);
