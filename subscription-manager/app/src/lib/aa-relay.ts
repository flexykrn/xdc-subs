import {
  createPublicClient,
  http,
  concat,
  pad,
  toHex,
  keccak256,
  encodeAbiParameters,
  parseAbiParameters,
  hexToBytes,
  bytesToHex,
  numberToHex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

// viem/account-abstraction utilities
import {
  getUserOperationHash,
  toPackedUserOperation,
} from "viem/account-abstraction";

const rpcUrl = process.env.NEXT_PUBLIC_APOTHEM_RPC_URL || "https://erpc.apothem.network";
const chainId = 51;
const entryPointAddress = "0x0000000071727De22E5E9d8BAf0edAc6f37da032" as `0x${string}`;
const factoryAddress = "0x91E60e0613810449d098b0b5Ec8b51A0FE8c8985" as `0x${string}`;

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

// SimpleAccountFactory ABI (minimal)
const factoryAbi = [
  {
    name: "createAccount",
    type: "function",
    inputs: [
      { name: "owner", type: "address" },
      { name: "salt", type: "uint256" },
    ],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "nonpayable",
  },
  {
    name: "getAddress",
    type: "function",
    inputs: [
      { name: "owner", type: "address" },
      { name: "salt", type: "uint256" },
    ],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
] as const;

// SimpleAccount ABI (minimal)
const simpleAccountAbi = [
  {
    name: "execute",
    type: "function",
    inputs: [
      { name: "dest", type: "address" },
      { name: "value", type: "uint256" },
      { name: "func", type: "bytes" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    name: "executeBatch",
    type: "function",
    inputs: [
      {
        name: "calls",
        type: "tuple[]",
        components: [
          { name: "target", type: "address" },
          { name: "value", type: "uint256" },
          { name: "data", type: "bytes" },
        ],
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    name: "getNonce",
    type: "function",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
] as const;

// EntryPoint ABI (minimal)
const entryPointAbi = [
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

export interface Call {
  to: `0x${string}`;
  value?: bigint;
  data: `0x${string}`;
}

export interface SmartAccountInfo {
  address: `0x${string}`;
  eoaAddress: `0x${string}`;
  isDeployed: boolean;
}

/**
 * Get the smart account address for an EOA owner
 */
export async function getSmartAccountAddress(owner: `0x${string}`, salt: bigint = 0n): Promise<`0x${string}`> {
  return publicClient.readContract({
    address: factoryAddress,
    abi: factoryAbi,
    functionName: "getAddress",
    args: [owner, salt],
  }) as Promise<`0x${string}`>;
}

/**
 * Get smart account info including deployment status
 */
export async function getSmartAccountInfo(
  privateKey: string,
  salt: bigint = 0n
): Promise<SmartAccountInfo> {
  const eoa = privateKeyToAccount(privateKey as `0x${string}`);
  const address = await getSmartAccountAddress(eoa.address, salt);
  const code = await publicClient.getBytecode({ address });
  return {
    address,
    eoaAddress: eoa.address,
    isDeployed: code !== undefined && code !== "0x",
  };
}

/**
 * Get the nonce for a smart account from EntryPoint
 */
export async function getAccountNonce(address: `0x${string}`, key: bigint = 0n): Promise<bigint> {
  return publicClient.readContract({
    address: entryPointAddress,
    abi: entryPointAbi,
    functionName: "getNonce",
    args: [address, key],
  }) as Promise<bigint>;
}

/**
 * Build initCode for smart account deployment
 */
export function buildInitCode(owner: `0x${string}`, salt: bigint = 0n): `0x${string}` {
  // encodeFunctionData for createAccount(owner, salt)
  const selector = "0x67c7315c"; // keccak256("createAccount(address,uint256)")[:4]
  const encoded = encodeAbiParameters(
    parseAbiParameters("address, uint256"),
    [owner, salt]
  );
  return concat([factoryAddress, selector, `0x${encoded.slice(2)}`]) as `0x${string}`;
}

/**
 * Encode a single call for SimpleAccount.execute
 */
export function encodeExecuteCall(call: Call): `0x${string}` {
  const selector = "0xb61d27f6"; // keccak256("execute(address,uint256,bytes)")[:4]
  const encoded = encodeAbiParameters(
    parseAbiParameters("address, uint256, bytes"),
    [call.to, call.value ?? 0n, call.data]
  );
  return concat([selector, `0x${encoded.slice(2)}`]) as `0x${string}`;
}

/**
 * Encode a batch call for SimpleAccount.executeBatch
 */
export function encodeExecuteBatchCall(calls: Call[]): `0x${string}` {
  const selector = "0x91289d51"; // keccak256("executeBatch((address,uint256,bytes)[])")[:4]
  const encoded = encodeAbiParameters(
    parseAbiParameters("(address target, uint256 value, bytes data)[]"),
    [calls.map((c) => ({ target: c.to, value: c.value ?? 0n, data: c.data }))]
  );
  return concat([selector, `0x${encoded.slice(2)}`]) as `0x${string}`;
}

/**
 * Build a complete UserOp for the relay
 */
export async function buildUserOp(params: {
  sender: `0x${string}`;
  privateKey: string;
  calls: Call[];
  isDeployed: boolean;
  owner: `0x${string}`;
  salt?: bigint;
}): Promise<any> {
  const { sender, privateKey, calls, isDeployed, owner, salt = 0n } = params;

  const nonce = await getAccountNonce(sender);

  const initCode = isDeployed ? "0x" : buildInitCode(owner, salt);
  const callData = calls.length === 1 ? encodeExecuteCall(calls[0]) : encodeExecuteBatchCall(calls);

  // Gas limits — these will be refined by estimation
  const verificationGasLimit = 150000n;
  const callGasLimit = 300000n;
  const preVerificationGas = 50000n;
  const maxPriorityFeePerGas = 1n; // very low for apothem
  const maxFeePerGas = 100n;

  return {
    sender,
    nonce,
    initCode,
    callData,
    callGasLimit,
    verificationGasLimit,
    preVerificationGas,
    maxPriorityFeePerGas,
    maxFeePerGas,
    paymaster: undefined,
    paymasterData: undefined,
    paymasterVerificationGasLimit: undefined,
    paymasterPostOpGasLimit: undefined,
    signature: "0x" as `0x${string}`,
  };
}

/**
 * Sign a UserOp with the smart account owner key
 */
export async function signUserOp(
  userOp: any,
  privateKey: string
): Promise<`0x${string}`> {
  const eoa = privateKeyToAccount(privateKey as `0x${string}`);

  const userOpHash = getUserOperationHash({
    userOperation: userOp,
    entryPointAddress,
    entryPointVersion: "0.7",
    chainId,
  });

  // Sign the raw hash (not EIP-191, the EntryPoint verifies against the raw hash for SimpleAccount)
  // Actually, SimpleAccount's validateUserOp expects an EIP-191 signature of the userOpHash
  const signature = await eoa.signMessage({
    message: { raw: userOpHash },
  });

  return signature;
}

/**
 * Get paymaster signature from backend
 */
export async function getPaymasterSignature(userOp: any): Promise<{
  paymasterAndData: `0x${string}`;
  paymasterHash: `0x${string}`;
}> {
  const response = await fetch("/api/aa/paymaster-sign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userOp }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Paymaster sign failed");
  }

  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || "Paymaster sign failed");
  }

  return {
    paymasterAndData: result.paymasterAndData,
    paymasterHash: result.paymasterHash,
  };
}

/**
 * Submit UserOp to backend relay
 */
export async function relayUserOp(packedUserOp: any): Promise<{
  txHash: `0x${string}`;
  status: string;
}> {
  const response = await fetch("/api/aa/relay", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userOp: packedUserOp }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Relay failed");
  }

  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || "Relay failed");
  }

  return {
    txHash: result.txHash,
    status: result.status,
  };
}

/**
 * Complete AA flow: build, sign, get paymaster data, sign again, relay
 */
export async function sendAATransaction(params: {
  privateKey: string;
  calls: Call[];
}): Promise<{ txHash: `0x${string}`; smartAccountAddress: `0x${string}` }> {
  const { privateKey, calls } = params;
  const eoa = privateKeyToAccount(privateKey as `0x${string}`);

  // Get smart account info
  const info = await getSmartAccountInfo(privateKey);
  console.log("[AA] Smart account:", info.address, "deployed:", info.isDeployed);

  // Build UserOp
  const userOp = await buildUserOp({
    sender: info.address,
    privateKey,
    calls,
    isDeployed: info.isDeployed,
    owner: eoa.address,
  });

  console.log("[AA] Built UserOp, nonce:", userOp.nonce);

  // Get paymaster signature (step 1)
  const { paymasterAndData } = await getPaymasterSignature(userOp);
  console.log("[AA] Got paymaster signature");

  // Parse paymasterAndData into components for viem
  // Structure: address(20) + pmVerGasLimit(16) + pmPostOpGasLimit(16) + signature
  userOp.paymaster = paymasterAndData.slice(0, 42) as `0x${string}`;
  userOp.paymasterVerificationGasLimit = BigInt("0x" + paymasterAndData.slice(42, 74));
  userOp.paymasterPostOpGasLimit = BigInt("0x" + paymasterAndData.slice(74, 106));
  userOp.paymasterData = paymasterAndData.slice(106) as `0x${string}`;

  // Sign the UserOp with smart account (step 2)
  const signature = await signUserOp(userOp, privateKey);
  userOp.signature = signature;
  console.log("[AA] Signed UserOp");

  // Pack the UserOp for relay
  const packed = toPackedUserOperation(userOp);
  console.log("[AA] Packed UserOp");

  // Relay
  const result = await relayUserOp(packed);
  console.log("[AA] Relayed, txHash:", result.txHash);

  return {
    txHash: result.txHash,
    smartAccountAddress: info.address,
  };
}
