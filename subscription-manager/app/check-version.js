const { ethers } = require("ethers");

const RPC_URL = "https://erpc.apothem.network";
const ENTRYPOINT = "0x0000000071727De22E5E9d8BAf0edAc6f37da032";

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  
  // Try calling getUserOpHash if it exists (v0.7)
  const ep = new ethers.Contract(ENTRYPOINT, [
    "function getUserOpHash(tuple(address sender,uint256 nonce,bytes initCode,bytes callData,bytes32 accountGasLimits,uint256 preVerificationGas,bytes32 gasFees,bytes paymasterAndData,bytes signature) userOp) view returns (bytes32)"
  ], provider);
  
  try {
    const hash = await ep.getUserOpHash({
      sender: "0x0000000000000000000000000000000000000000",
      nonce: 0,
      initCode: "0x",
      callData: "0x",
      accountGasLimits: "0x0000000000000000000000000000000000000000000000000000000000000000",
      preVerificationGas: 0,
      gasFees: "0x0000000000000000000000000000000000000000000000000000000000000000",
      paymasterAndData: "0x",
      signature: "0x"
    });
    console.log("getUserOpHash works! Hash:", hash);
    console.log("EntryPoint is v0.7");
  } catch(e) {
    console.log("getUserOpHash failed:", e.message);
    console.log("EntryPoint might be v0.6 or different");
  }
}

main().catch(console.error);
