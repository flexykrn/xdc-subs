import { ethers } from "ethers";

const RPC_URL = "https://erpc.apothem.network";
const ENTRYPOINT = "0x0000000071727De22E5E9d8BAf0edAc6f37da032";
const SA = "0x6302F0b313374c604067e286C17354527F9692fD";
const PAYMASTER = "0x8361Fae5A25e71C2E1db35cDE13E7150bB7b1a42";
const BUNDLER_KEY = "0x851f2396c6ff431410782c211db3a996a332f0decad132f21d5f60bb077f35e9";

const SA_ABI = ["function execute(address target,uint256 value,bytes calldata data) external"];
const EP_ABI = [
  "function getNonce(address sender,uint192 key) view returns (uint256)",
  "function handleOps(tuple(address sender,uint256 nonce,bytes initCode,bytes callData,bytes32 accountGasLimits,uint256 preVerificationGas,bytes32 gasFees,bytes paymasterAndData,bytes signature)[] calldata ops,address beneficiary) external"
];
const PM_ABI = [
  "function getHash(tuple(address sender,uint256 nonce,bytes initCode,bytes callData,bytes32 accountGasLimits,uint256 preVerificationGas,bytes32 gasFees,bytes paymasterAndData,bytes signature) userOp) view returns (bytes32)"
];

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(BUNDLER_KEY, provider);
  const ep = new ethers.Contract(ENTRYPOINT, EP_ABI, wallet);
  const pm = new ethers.Contract(PAYMASTER, PM_ABI, provider);
  const sa = new ethers.Contract(SA, SA_ABI, provider);
  
  // Build a simple no-op callData
  const callData = sa.interface.encodeFunctionData("execute", [
    "0x0000000000000000000000000000000000000000",
    0,
    "0x"
  ]);
  
  const nonce = await ep.getNonce(SA, 0);
  console.log("Nonce:", nonce.toString());
  
  const accountGasLimits = ethers.zeroPadValue(ethers.toBeHex(150000n << 128n | 300000n), 32);
  const gasFees = ethers.zeroPadValue(ethers.toBeHex(1000000000n << 128n | 1000000000n), 32);
  
  // Build userOp for paymaster hash
  const testOp = {
    sender: SA,
    nonce,
    initCode: "0x",
    callData,
    accountGasLimits,
    preVerificationGas: 50000,
    gasFees,
    paymasterAndData: "0x",
    signature: "0x"
  };
  
  // Get paymaster hash
  const pmHash = await pm.getHash(testOp);
  console.log("Paymaster hash:", pmHash);
  
  // Sign with paymaster key
  const pmSignature = await wallet.signMessage(ethers.getBytes(pmHash));
  
  // Build paymasterAndData
  const pmAndData = ethers.concat([
    PAYMASTER,
    ethers.zeroPadValue("0x0186A0", 16), // 100000 in hex
    ethers.zeroPadValue("0x00", 16),      // 0
    pmSignature
  ]);
  
  console.log("PaymasterAndData length:", pmAndData.length);
  
  // Compute userOp hash manually (EntryPoint v0.7)
  const inner = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
    ["address","uint256","bytes32","bytes32","bytes32","uint256","bytes32","bytes32"],
    [SA, nonce, ethers.keccak256("0x"), ethers.keccak256(callData), accountGasLimits, 50000, gasFees, ethers.keccak256(pmAndData)]
  ));
  const userOpHash = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
    ["bytes32","address","uint256"],
    [inner, ENTRYPOINT, 51n]
  ));
  
  console.log("UserOp hash:", userOpHash);
  
  // Sign userOp
  const signature = await wallet.signMessage(ethers.getBytes(userOpHash));
  
  // Submit
  try {
    const tx = await ep.handleOps([[SA, nonce, "0x", callData, accountGasLimits, 50000, gasFees, pmAndData, signature]], wallet.address, { gasLimit: 2000000 });
    console.log("Tx:", tx.hash);
    const receipt = await tx.wait();
    console.log("Status:", receipt.status === 1 ? "SUCCESS" : "FAILED");
  } catch(e) {
    console.error("Error:", e.message);
    if (e.receipt) {
      console.log("Receipt status:", e.receipt.status);
      console.log("Gas used:", e.receipt.gasUsed.toString());
    }
  }
}

main().catch(console.error);
