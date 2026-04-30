const { ethers } = require("ethers");

const RPC_URL = "https://erpc.apothem.network";
const SA = "0x6302F0b313374c604067e286C17354527F9692fD";
const ENTRYPOINT = "0x0000000071727De22E5E9d8BAf0edAc6f37da032";

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  
  // Check SA code
  const code = await provider.getCode(SA);
  console.log("SA code length:", code.length > 2 ? "deployed" : "NOT deployed");
  
  // Check SA balance
  const balance = await provider.getBalance(SA);
  console.log("SA tXDC balance:", ethers.formatEther(balance));
  
  // Check EntryPoint nonce
  const ep = new ethers.Contract(ENTRYPOINT, [
    "function getNonce(address sender, uint192 key) view returns (uint256)"
  ], provider);
  const nonce = await ep.getNonce(SA, 0);
  console.log("SA nonce:", nonce.toString());
}

main().catch(console.error);
