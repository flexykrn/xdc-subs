const { ethers } = require("ethers");

const RPC_URL = "https://erpc.apothem.network";
const ENTRYPOINT = "0x0000000071727De22E5E9d8BAf0edAc6f37da032";

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const code = await provider.getCode(ENTRYPOINT);
  console.log("EntryPoint code length:", code.length);
  console.log("Has code:", code.length > 2);
}

main().catch(console.error);
