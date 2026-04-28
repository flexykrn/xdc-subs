import { APOTHEM_CHAIN } from "@/config/chains";
import { createPublicClient, createWalletClient, http, concat, toHex, keccak256, encodeFunctionData, parseAbi } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const rpcUrl = process.env.NEXT_PUBLIC_APOTHEM_RPC_URL || "https://erpc.apothem.network";
const entryPointAddress = (process.env.NEXT_PUBLIC_ENTRYPOINT_ADDRESS || "0x0000000071727De22E5E9d8BAf0edAc6f37da032") as `0x${string}`;
const factoryAddress = (process.env.NEXT_PUBLIC_SIMPLE_ACCOUNT_FACTORY_ADDRESS || "0x91E60e0613810449d098b0b5Ec8b51A0FE8c8985") as `0x${string}`;
const paymasterAddress = (process.env.NEXT_PUBLIC_PAYMASTER_ADDRESS || "0x8361Fae5A25e71C2E1db35cDE13E7150bB7b1a42") as `0x${string}`;
const chainId = 51;

const viemChain = {
  id: chainId,
  name: "XDC Apothem",
  nativeCurrency: { name: "XDC", symbol: "XDC", decimals: 18 },
  rpcUrls: { default: { http: [rpcUrl] }, public: { http: [rpcUrl] } },
  testnet: true,
} as const;

const publicClient = createPublicClient({
  chain: viemChain,
  transport: http(rpcUrl),
});

// EntryPoint v0.7 ABI (minimal)
const entryPointAbi = [
  {
    name: "getUserOpHash",
    type: "function",
    inputs: [
      {
        name: "userOp",
        type: "tuple",
        components: [
          { name: "sender", type: "address" },
          { name: "nonce", type: "uint256" },
          { name: "initCode", type: "bytes" },
          { name: "callData", type: "bytes" },
          { name: "accountGasLimits", type: "bytes32" },
          { name: "preVerificationGas", type: "uint256" },
          { name: "gasFees", type: "bytes32" },
          { name: "paymasterAndData", type: "bytes" },
          { name: "signature", type: "bytes" },
        ],
      },
    ],
    outputs: [{ name: "", type: "bytes32" }],
    stateMutability: "view",
  },
  {
    name: "handleOps",
    type: "function",
    inputs: [
      {
        name: "ops",
        type: "tuple[]",
        components: [
          { name: "sender", type: "address" },
          { name: "nonce", type: "uint256" },
          { name: "initCode", type: "bytes" },
          { name: "callData", type: "bytes" },
          { name: "accountGasLimits", type: "bytes32" },
          { name: "preVerificationGas", type: "uint256" },
          { name: "gasFees", type: "bytes32" },
          { name: "paymasterAndData", type: "bytes" },
          { name: "signature", type: "bytes" },
        ],
      },
      { name: "beneficiary", type: "address" },
    ],
    outputs: [],
    stateMutability: "payable",
  },
  {
    name: "getNonce",
    type: "function",
    inputs: [
      { name: "sender", type: "address" },
      { name: "key", type: "uint192" },
    ],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
] as const;

// SimpleAccountFactory ABI
const factoryAbi = parseAbi([
  "function createAccount(address owner, uint256 salt) returns (address account)",
  "function getAddress(address owner, uint256 salt) view returns (address)",
]);

// SimpleAccount ABI
const accountAbi = parseAbi([
  "function execute(address dest, uint256 value, bytes func)",
  "function getNonce() view returns (uint256)",
]);

// SubscriptionManager ABI
const managerAbi = parseAbi([
  "function subscribe(uint256 planId) returns (uint256 subscriptionId)",
  "function renew(uint256 subscriptionId)",
  "function pause(uint256 subscriptionId)",
  "function cancel(uint256 subscriptionId)",
]);

// ERC20 ABI
const erc20Abi = parseAbi([
  "function approve(address spender, uint256 amount) returns (bool)",
]);

export type GasMode = "sponsor" | "erc20" | "multi-token";

interface PackedUserOperation {
  sender: `0x${string}`;
  nonce: bigint;
  initCode: `0x${string}`;
  callData: `0x${string}`;
  accountGasLimits: `0x${string}`;
  preVerificationGas: bigint;
  gasFees: `0x${string}`;
  paymasterAndData: `0x${string}`;
  signature: `0x${string}`;
}

// ── Smart Account ──

export async function getSmartAccountAddress(ownerAddress: string): Promise<`0x${string}`> {
  return await publicClient.readContract({
    address: factoryAddress,
    abi: factoryAbi,
    functionName: "getAddress",
    args: [ownerAddress as `0x${string}`, 0n],
  }) as `0x${string}`;
}

async function isAccountDeployed(address: `0x${string}`): Promise<boolean> {
  const code = await publicClient.getBytecode({ address });
  return code !== undefined && code !== "0x";
}

async function getNonce(smartAccountAddress: `0x${string}`): Promise<bigint> {
  const deployed = await isAccountDeployed(smartAccountAddress);
  if (!deployed) return 0n;
  return await publicClient.readContract({
    address: smartAccountAddress,
    abi: accountAbi,
    functionName: "getNonce",
  }) as bigint;
}

// ── UserOp Building ──

function packGasLimits(verificationGasLimit: bigint, callGasLimit: bigint): `0x${string}` {
  return concat([toHex(verificationGasLimit, { size: 16 }), toHex(callGasLimit, { size: 16 })]) as `0x${string}`;
}

function packGasFees(maxPriorityFeePerGas: bigint, maxFeePerGas: bigint): `0x${string}` {
  return concat([toHex(maxPriorityFeePerGas, { size: 16 }), toHex(maxFeePerGas, { size: 16 })]) as `0x${string}`;
}

function buildInitCode(ownerAddress: `0x${string}`): `0x${string}` {
  const callData = encodeFunctionData({
    abi: factoryAbi,
    functionName: "createAccount",
    args: [ownerAddress, 0n],
  });
  return concat([factoryAddress, callData]);
}

function buildAccountCallData(
  target: `0x${string}`,
  value: bigint,
  data: `0x${string}`
): `0x${string}` {
  return encodeFunctionData({
    abi: accountAbi,
    functionName: "execute",
    args: [target, value, data],
  });
}

// ── Paymaster ──

async function getPaymasterSignature(userOp: PackedUserOperation): Promise<`0x${string}`> {
  const res = await fetch("/api/aa/paymaster-sign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userOp }),
  });
  const data = await res.json();
  if (!data.success) throw new Error("Paymaster sign failed: " + (data.error || "Unknown"));
  return data.paymasterAndData as `0x${string}`;
}

// ── Sign & Send ──

async function signUserOp(
  userOp: PackedUserOperation,
  ownerPrivateKey: string
): Promise<PackedUserOperation> {
  const hash = await publicClient.readContract({
    address: entryPointAddress,
    abi: entryPointAbi,
    functionName: "getUserOpHash",
    args: [{
      sender: userOp.sender,
      nonce: userOp.nonce,
      initCode: userOp.initCode,
      callData: userOp.callData,
      accountGasLimits: userOp.accountGasLimits,
      preVerificationGas: userOp.preVerificationGas,
      gasFees: userOp.gasFees,
      paymasterAndData: userOp.paymasterAndData,
      signature: userOp.signature,
    }],
  }) as `0x${string}`;

  console.log("[AA] UserOp hash:", hash);

  const account = privateKeyToAccount(ownerPrivateKey as `0x${string}`);
  const signature = await account.signMessage({ message: { raw: hash } });

  return { ...userOp, signature };
}

async function submitUserOp(userOp: PackedUserOperation): Promise<string> {
  const res = await fetch("/api/aa/relay", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userOp }),
  });
  const data = await res.json();
  if (!data.success) throw new Error("Relay failed: " + (data.error || data.details || "Unknown"));
  console.log("[AA] Relay txHash:", data.txHash);
  return data.txHash;
}

// ── Main AA Action ──

async function buildAndSendUserOp(
  ownerPrivateKey: string,
  ownerAddress: string,
  calls: { target: `0x${string}`; value: bigint; data: `0x${string}` }[],
  mode: GasMode
): Promise<{ txHash: string; userOpHash: string; explorerUrl: string }> {
  const smartAccountAddress = await getSmartAccountAddress(ownerAddress);
  console.log("[AA] Smart account:", smartAccountAddress);

  const deployed = await isAccountDeployed(smartAccountAddress);
  const nonce = await getNonce(smartAccountAddress);

  // Build batched callData (SimpleAccount.execute for each call)
  // For multiple calls, we need to use executeBatch or multiple UserOps
  // For simplicity, single execute per UserOp
  const call = calls[0];
  const callData = buildAccountCallData(call.target, call.value, call.data);

  const verificationGasLimit = 150000n;
  const callGasLimit = 300000n;
  const maxPriorityFeePerGas = 1000000000n; // 1 gwei
  const maxFeePerGas = 25000000000n; // 25 gwei
  const preVerificationGas = 70000n;

  let userOp: PackedUserOperation = {
    sender: smartAccountAddress,
    nonce,
    initCode: deployed ? "0x" : buildInitCode(ownerAddress as `0x${string}`),
    callData,
    accountGasLimits: packGasLimits(verificationGasLimit, callGasLimit),
    preVerificationGas,
    gasFees: packGasFees(maxPriorityFeePerGas, maxFeePerGas),
    paymasterAndData: "0x",
    signature: "0x",
  };

  // Get paymaster signature for sponsor mode
  if (mode === "sponsor" || mode === "multi-token") {
    console.log("[AA] Getting paymaster signature...");
    userOp.paymasterAndData = await getPaymasterSignature(userOp);
  }

  // Sign UserOp
  console.log("[AA] Signing UserOp...");
  userOp = await signUserOp(userOp, ownerPrivateKey);

  // Submit
  console.log("[AA] Submitting to EntryPoint...");
  const txHash = await submitUserOp(userOp);

  const userOpHash = await publicClient.readContract({
    address: entryPointAddress,
    abi: entryPointAbi,
    functionName: "getUserOpHash",
    args: [{
      sender: userOp.sender,
      nonce: userOp.nonce,
      initCode: userOp.initCode,
      callData: userOp.callData,
      accountGasLimits: userOp.accountGasLimits,
      preVerificationGas: userOp.preVerificationGas,
      gasFees: userOp.gasFees,
      paymasterAndData: userOp.paymasterAndData,
      signature: userOp.signature,
    }],
  }) as `0x${string}`;

  const explorerUrl = `${APOTHEM_CHAIN.explorerUrl}tx/${txHash}`;
  return { txHash, userOpHash, explorerUrl };
}

// ── Public API ──

export async function sendSubscriptionUserOp(
  privateKey: string,
  subscriptionManagerAddress: string,
  planId: number,
  mode: GasMode,
  tokenAddress?: string,
  price?: string
): Promise<{ txHash: string; explorerUrl: string; userOpHash: string }> {
  const owner = privateKeyToAccount(privateKey as `0x${string}`);

  const calls: { target: `0x${string}`; value: bigint; data: `0x${string}` }[] = [];

  // If ERC20, approve first
  if ((mode === "erc20" || mode === "multi-token") && tokenAddress && price) {
    const approveData = encodeFunctionData({
      abi: erc20Abi,
      functionName: "approve",
      args: [subscriptionManagerAddress as `0x${string}`, BigInt(price) * BigInt(10)],
    });
    calls.push({ target: tokenAddress as `0x${string}`, value: 0n, data: approveData });
  }

  // Subscribe call
  const subscribeData = encodeFunctionData({
    abi: managerAbi,
    functionName: "subscribe",
    args: [BigInt(planId)],
  });
  calls.push({ target: subscriptionManagerAddress as `0x${string}`, value: 0n, data: subscribeData });

  // For multiple calls, we need a batch execute. SimpleAccount has executeBatch?
  // For now, if ERC20, we do approve as a separate UserOp first, then subscribe
  if (calls.length === 2) {
    // Send approve UserOp first
    console.log("[AA] Sending approve UserOp first...");
    await buildAndSendUserOp(privateKey, owner.address, [calls[0]], mode);
    // Then send subscribe UserOp
    return await buildAndSendUserOp(privateKey, owner.address, [calls[1]], mode);
  }

  return await buildAndSendUserOp(privateKey, owner.address, calls, mode);
}

export async function sendLifecycleUserOp(
  privateKey: string,
  subscriptionManagerAddress: string,
  subscriptionId: number,
  action: "renew" | "pause" | "cancel",
  mode: GasMode = "sponsor"
): Promise<{ txHash: string; explorerUrl: string; userOpHash: string }> {
  const owner = privateKeyToAccount(privateKey as `0x${string}`);

  const data = encodeFunctionData({
    abi: managerAbi,
    functionName: action,
    args: [BigInt(subscriptionId)],
  });

  return await buildAndSendUserOp(privateKey, owner.address, [
    { target: subscriptionManagerAddress as `0x${string}`, value: 0n, data },
  ], mode);
}
