const { ethers } = require("ethers");

const RPC_URL = "https://erpc.apothem.network";
const PAYMASTER = "0x8361Fae5A25e71C2E1db35cDE13E7150bB7b1a42";
const SA = "0x6302F0b313374c604067e286C17354527F9692fD";

// Build proper 32-byte accountGasLimits
const verGas = 150000n;
const callGas = 300000n;
const accountGasLimits = ethers.zeroPadValue(ethers.toBeHex((verGas << 128n) | callGas), 32);

console.log("accountGasLimits:", accountGasLimits);
console.log("Length:", accountGasLimits.length);

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  
  const pm = new ethers.Contract(PAYMASTER, [
    "function getHash(tuple(address sender,uint256 nonce,bytes initCode,bytes callData,bytes32 accountGasLimits,uint256 preVerificationGas,bytes32 gasFees,bytes paymasterAndData,bytes signature) userOp) view returns (bytes32)"
  ], provider);
  
  const testOp = {
    sender: SA,
    nonce: 0,
    initCode: "0x",
    callData: "0x",
    accountGasLimits,
    preVerificationGas: 50000,
    gasFees: ethers.zeroPadValue(ethers.toBeHex((1000000000n << 128n) | 1000000000n), 32),
    paymasterAndData: "0x",
    signature: "0x"
  };
  
  console.log("\nTest UserOp:", JSON.stringify(testOp, null, 2));
  
  try {
    const contractHash = await pm.getHash(testOp);
    console.log("\nContract hash:", contractHash);
    
    // Manual computation
    const gasFeesHex = testOp.gasFees.slice(2);
    const maxPriorityFeePerGas = BigInt("0x" + gasFeesHex.slice(0, 32));
    const maxFeePerGas = BigInt("0x" + gasFeesHex.slice(32, 64));
    
    const inner = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
      ["address","uint256","bytes32","bytes32","bytes32","uint256","uint256","uint256","uint256","address"],
      [
        testOp.sender,
        testOp.nonce,
        ethers.keccak256(testOp.initCode),
        ethers.keccak256(testOp.callData),
        testOp.accountGasLimits,
        testOp.preVerificationGas,
        maxPriorityFeePerGas,
        maxFeePerGas,
        51,
        PAYMASTER
      ]
    ));
    
    console.log("Manual hash:", inner);
    console.log("Match:", contractHash === inner);
  } catch(e) {
    console.error("Error:", e.message);
  }
}

main().catch(console.error);
