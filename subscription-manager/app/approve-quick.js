const { ethers } = require("ethers");

const RPC_URL = "https://erpc.apothem.network";
const ENTRYPOINT = "0x0000000071727De22E5E9d8BAf0edAc6f37da032";
const SA = "0x6302F0b313374c604067e286C17354527F9692fD";
const TOKEN_PAYMASTER = "0x17D390EdEb894d8c8B5cD5e6fD47Db923CB4A2c4";
const BUNDLER_KEY = "0x851f2396c6ff431410782c211db3a996a332f0decad132f21d5f60bb077f35e9";
const SPONSOR_PAYMASTER = "0x8361Fae5A25e71C2E1db35cDE13E7150bB7b1a42";

const TOKENS = [
  "0x896F79883Bf0620Afcd3D8942f1Db8d3F447AE84",
  "0x9F00925759A9F0FEb13373336B761A7267AE66a9",
  "0x591CCebbd943a2F9a11F64eBf627d86600a0f38e",
  "0x87CB2de7edc1B9D725a5a6DeDdcbEF7e36fe3084",
  "0xA228078133e812677533166A44187c1Ae696687A",
  "0x4c4456bF7A0e572D2C697626025DcB6d3D3Df7D1",
];

const ERC20_ABI = ["function approve(address spender,uint256 amount)", "function allowance(address,address) view returns (uint256)"];
const SA_ABI = ["function execute(address target,uint256 value,bytes calldata data) external"];
const EP_ABI = ["function getNonce(address sender,uint192 key) view returns (uint256)", "function handleOps(tuple(address sender,uint256 nonce,bytes initCode,bytes callData,bytes32 accountGasLimits,uint256 preVerificationGas,bytes32 gasFees,bytes paymasterAndData,bytes signature)[] calldata ops,address beneficiary) external"];

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(BUNDLER_KEY, provider);
  const ep = new ethers.Contract(ENTRYPOINT, EP_ABI, wallet);
  const sa = new ethers.Contract(SA, SA_ABI, provider);
  
  for (const tokenAddr of TOKENS) {
    const token = new ethers.Contract(tokenAddr, ERC20_ABI, provider);
    const allowance = await token.allowance(SA, TOKEN_PAYMASTER);
    if (allowance > 0n) { console.log(`${tokenAddr.slice(0,8)}... already approved`); continue; }
    
    const approveData = token.interface.encodeFunctionData("approve", [TOKEN_PAYMASTER, ethers.MaxUint256]);
    const callData = sa.interface.encodeFunctionData("execute", [tokenAddr, 0, approveData]);
    
    const nonce = await ep.getNonce(SA, 0);
    const accountGasLimits = ethers.zeroPadValue(ethers.toBeHex(150000n << 128n | 300000n), 32);
    const gasFees = ethers.zeroPadValue(ethers.toBeHex(1000000000n << 128n | 1000000000n), 32);
    
    // Build userOp hash (v0.7)
    const inner = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
      ["address","uint256","bytes32","bytes32","bytes32","uint256","bytes32","bytes32"],
      [SA, nonce, ethers.keccak256("0x"), ethers.keccak256(callData), accountGasLimits, 50000, gasFees, ethers.keccak256("0x")]
    ));
    const uoHash = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(["bytes32","address","uint256"], [inner, ENTRYPOINT, 51n]));
    
    // Sign
    const sig = await wallet.signMessage(ethers.getBytes(uoHash));
    
    // For sponsor mode, we need paymaster signature
    // Let's skip paymaster and just use self-funded since SA has 2 tXDC
    const tx = await ep.handleOps([[SA, nonce, "0x", callData, accountGasLimits, 50000, gasFees, "0x", sig]], wallet.address, { gasLimit: 2000000 });
    console.log(`${tokenAddr.slice(0,8)}... tx: ${tx.hash}`);
    await tx.wait();
    console.log(`${tokenAddr.slice(0,8)}... ✅ approved`);
  }
}

main().catch(console.error);
