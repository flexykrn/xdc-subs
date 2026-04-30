const { createPublicClient, http, parseAbi, decodeFunctionData, keccak256, encodePacked } = require("viem");

const RPC = "https://erpc.apothem.network";
const TX = "0x01da83cbda6f1cee419a694dee88ab09fc8b360385077cc15c6dbe9460737028";
const ENTRYPOINT = "0x0000000071727De22E5E9d8BAf0edAc6f37da032";

async function main() {
  const client = createPublicClient({ transport: http(RPC) });
  
  // Decode the UserOp from the tx
  const tx = await client.getTransaction({ hash: TX });
  const decoded = decodeFunctionData({
    abi: parseAbi(['function handleOps((address sender, uint256 nonce, bytes initCode, bytes callData, bytes32 accountGasLimits, uint256 preVerificationGas, bytes32 gasFees, bytes paymasterAndData, bytes signature)[] ops, address beneficiary) external']),
    data: tx.input,
  });
  const userOp = decoded.args[0][0];
  
  console.log("UserOp sender:", userOp.sender);
  console.log("UserOp nonce:", userOp.nonce.toString());
  console.log("UserOp initCode:", userOp.initCode.slice(0, 66) + "...");
  
  // Try calling EntryPoint.getUserOpHash directly
  try {
    const onChainHash = await client.readContract({
      address: ENTRYPOINT,
      abi: parseAbi(['function getUserOpHash((address sender, uint256 nonce, bytes initCode, bytes callData, bytes32 accountGasLimits, uint256 preVerificationGas, bytes32 gasFees, bytes paymasterAndData, bytes signature) userOp) external view returns (bytes32)']),
      functionName: "getUserOpHash",
      args: [userOp],
    });
    console.log("\nOn-chain UserOp hash:", onChainHash);
    
    // Compute our hash
    const ourHash = keccak256(encodePacked(
      ["bytes32", "address", "uint256"],
      [keccak256(encodePacked(
        ["address", "uint256", "bytes32", "bytes32", "bytes32", "uint256", "bytes32", "bytes32"],
        [
          userOp.sender,
          userOp.nonce,
          keccak256(userOp.initCode),
          keccak256(userOp.callData),
          userOp.accountGasLimits,
          userOp.preVerificationGas,
          userOp.gasFees,
          keccak256(userOp.paymasterAndData),
        ]
      )), ENTRYPOINT, 51n]
    ));
    console.log("Our computed hash:", ourHash);
    console.log("Hash match?", onChainHash === ourHash ? "YES ✅" : "NO ❌");
    
  } catch(e) {
    console.error("getUserOpHash error:", e.message);
  }
  
  // Check if sender already has code
  const code = await client.getBytecode({ address: userOp.sender });
  console.log("\nSender code:", code?.length || 0);
  
  // Try simulateHandleOp if available
  try {
    await client.readContract({
      address: ENTRYPOINT,
      abi: parseAbi(['function simulateHandleOp((address sender, uint256 nonce, bytes initCode, bytes callData, bytes32 accountGasLimits, uint256 preVerificationGas, bytes32 gasFees, bytes paymasterAndData, bytes signature) op, address target, bytes calldata callData) external']),
      functionName: "simulateHandleOp",
      args: [userOp, userOp.sender, "0x"],
    });
    console.log("simulateHandleOp: ok");
  } catch(e) {
    console.log("\nsimulateHandleOp error:", e.shortMessage || e.message);
    if (e.data) console.log("Error data:", e.data);
  }
}

main().catch(console.error);
