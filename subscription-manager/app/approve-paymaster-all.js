const { ethers } = require("ethers");

const RPC_URL = "https://erpc.apothem.network";
const ENTRYPOINT = "0x0000000071727De22E5E9d8BAf0edAc6f37da032";
const SA = "0x6302F0b313374c604067e286C17354527F9692fD";
const TOKEN_PAYMASTER = "0x17D390EdEb894d8c8B5cD5e6fD47Db923CB4A2c4";
const BUNDLER_KEY = "0x851f2396c6ff431410782c211db3a996a332f0decad132f21d5f60bb077f35e9";

const TOKENS = [
  { name: "Netflix", address: "0x896F79883Bf0620Afcd3D8942f1Db8d3F447AE84" },
  { name: "Spotify", address: "0x9F00925759A9F0FEb13373336B761A7267AE66a9" },
  { name: "YouTube", address: "0x591CCebbd943a2F9a11F64eBf627d86600a0f38e" },
  { name: "JioHotstar", address: "0x87CB2de7edc1B9D725a5a6DeDdcbEF7e36fe3084" },
  { name: "Claude", address: "0xA228078133e812677533166A44187c1Ae696687A" },
  { name: "Copilot", address: "0x4c4456bF7A0e572D2C697626025DcB6d3D3Df7D1" },
];

const ERC20_ABI = [
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
];

const SIMPLE_ACCOUNT_ABI = [
  "function execute(address target, uint256 value, bytes calldata data) external",
  "function executeBatch(address[] calldata dest, uint256[] calldata value, bytes[] calldata func) external",
];

const ENTRYPOINT_ABI = [
  "function getNonce(address sender, uint192 key) view returns (uint256)",
  "function handleOps((address sender, uint256 nonce, bytes initCode, bytes callData, bytes32 accountGasLimits, uint256 preVerificationGas, bytes32 gasFees, bytes paymasterAndData, bytes signature)[] ops, address beneficiary) external",
];

const PAYMASTER_ABI = [
  "function getHash(address sender, uint256 nonce, bytes32 initCodeHash, bytes32 callDataHash, bytes32 accountGasLimits, uint256 preVerificationGas, bytes32 gasFees, uint256 chainid, address paymaster) view returns (bytes32)",
];

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const bundlerWallet = new ethers.Wallet(BUNDLER_KEY, provider);
  
  console.log("Bundler:", bundlerWallet.address);
  console.log("SA:", SA);
  console.log("\nApproving TokenPaymaster for all tokens...\n");
  
  for (const token of TOKENS) {
    // Check current allowance
    const tokenContract = new ethers.Contract(token.address, ERC20_ABI, provider);
    const currentAllowance = await tokenContract.allowance(SA, TOKEN_PAYMASTER);
    
    if (currentAllowance > 0n) {
      console.log(`${token.name}: Already approved (${ethers.formatEther(currentAllowance)})`);
      continue;
    }
    
    // Build approve callData
    const approveData = tokenContract.interface.encodeFunctionData("approve", [
      TOKEN_PAYMASTER,
      ethers.MaxUint256, // unlimited approval
    ]);
    
    // Build execute() callData for SimpleAccount
    const saContract = new ethers.Contract(SA, SIMPLE_ACCOUNT_ABI, provider);
    const executeData = saContract.interface.encodeFunctionData("execute", [
      token.address,
      0,
      approveData,
    ]);
    
    // Get nonce
    const entryPoint = new ethers.Contract(ENTRYPOINT, ENTRYPOINT_ABI, provider);
    const nonce = await entryPoint.getNonce(SA, 0);
    
    // Build UserOp
    const userOp = {
      sender: SA,
      nonce: nonce,
      initCode: "0x",
      callData: executeData,
      accountGasLimits: "0x000000000000000249f0000000000000493e0", // verificationGasLimit=150k, callGasLimit=300k
      preVerificationGas: 50000,
      gasFees: "0x00000000000000003b9aca00000000003b9aca00", // maxPriorityFee=1gwei, maxFee=1gwei
      paymasterAndData: "0x",
      signature: "0x",
    };
    
    // Sign UserOp hash
    const opHash = await entryPoint.getUserOpHash([
      userOp.sender,
      userOp.nonce,
      userOp.initCode,
      userOp.callData,
      userOp.accountGasLimits,
      userOp.preVerificationGas,
      userOp.gasFees,
      userOp.paymasterAndData,
      userOp.signature,
    ]);
    
    // For sponsor mode, we need the VerifyingPaymaster signature
    // Let me use the paymaster API
    const pmRes = await fetch("http://localhost:3000/api/paymaster/sign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sender: userOp.sender,
        nonce: userOp.nonce.toString(),
        initCode: userOp.initCode,
        callData: userOp.callData,
        accountGasLimits: userOp.accountGasLimits,
        preVerificationGas: userOp.preVerificationGas.toString(),
        gasFees: userOp.gasFees,
      }),
    });
    
    if (!pmRes.ok) {
      console.error(`${token.name}: Paymaster signing failed`, await pmRes.text());
      continue;
    }
    
    const pmData = await pmRes.json();
    userOp.paymasterAndData = pmData.paymasterAndData;
    
    // Sign with bundler key (owner of SA)
    const signature = await bundlerWallet.signMessage(ethers.getBytes(opHash));
    userOp.signature = signature;
    
    // Submit to EntryPoint directly
    const tx = await entryPoint.handleOps([[
      userOp.sender,
      userOp.nonce,
      userOp.initCode,
      userOp.callData,
      userOp.accountGasLimits,
      userOp.preVerificationGas,
      userOp.gasFees,
      userOp.paymasterAndData,
      userOp.signature,
    ]], bundlerWallet.address, { gasLimit: 2000000 });
    
    console.log(`${token.name}: Approve tx: ${tx.hash}`);
    await tx.wait();
    console.log(`${token.name}: ✅ Approved`);
  }
  
  console.log("\n=== ALL APPROVALS COMPLETE ===");
}

main().catch(console.error);
