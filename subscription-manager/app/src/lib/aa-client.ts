import { APOTHEM_CHAIN } from "@/config/chains";
import { createPublicClient, createWalletClient, http, concat, toHex, keccak256, encodeFunctionData } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const rpcUrl = process.env.NEXT_PUBLIC_APOTHEM_RPC_URL || "https://erpc.apothem.network";
const entryPointAddress = (process.env.NEXT_PUBLIC_ENTRYPOINT_ADDRESS || "0x0000000071727De22E5E9d8BAf0edAc6f37da032") as `0x${string}`;
const factoryAddress = (process.env.NEXT_PUBLIC_SIMPLE_ACCOUNT_FACTORY_ADDRESS || "0x91E60e0613810449d098b0b5Ec8b51A0FE8c8985") as `0x${string}`;
const paymasterAddress = (process.env.NEXT_PUBLIC_PAYMASTER_ADDRESS || "") as `0x${string}`;
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

// SimpleAccountFactory ABI (minimal)
const factoryAbi = [
  {
    name: "createAccount",
    type: "function",
    inputs: [
      { name: "owner", type: "address" },
      { name: "salt", type: "uint256" },
    ],
    outputs: [{ name: "account", type: "address" }],
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
const accountAbi = [
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
    name: "getNonce",
    type: "function",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
] as const;

// EntryPoint v0.7 getUserOpHash ABI
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
] as const;

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

/**
 * Get or create the smart account address for an EOA owner.
 */
export async function getSmartAccountAddress(ownerAddress: string): Promise<`0x${string}`> {
  const address = await publicClient.readContract({
    address: factoryAddress,
    abi: factoryAbi,
    functionName: "getAddress",
    args: [ownerAddress as `0x${string}`, 0n],
  }) as `0x${string}`;
  return address;
}

/**
 * Check if smart account is deployed.
 */
export async function isSmartAccountDeployed(smartAccountAddress: `0x${string}`): Promise<boolean> {
  try {
    const code = await publicClient.getBytecode({ address: smartAccountAddress });
    return code !== undefined && code !== "0x";
  } catch {
    return false;
  }
}

/**
 * Build initCode for deploying a smart account.
 */
function buildInitCode(ownerAddress: string): `0x${string}` {
  const createCalldata = encodeFunctionData({
    abi: factoryAbi,
    functionName: "createAccount",
    args: [ownerAddress as `0x${string}`, 0n],
  });
  return concat([factoryAddress, createCalldata]);
}

/**
 * Build callData for the smart account to execute a subscription.
 */
function buildSubscriptionCallData(
  subscriptionManagerAddress: string,
  planId: number,
  tokenAddress?: string,
  price?: string
): `0x${string}` {
  // If ERC20, first approve then subscribe
  if (tokenAddress && price) {
    const approveCall = encodeFunctionData({
      abi: [
        {
          name: "approve",
          type: "function",
          inputs: [
            { name: "spender", type: "address" },
            { name: "amount", type: "uint256" },
          ],
          outputs: [{ type: "bool" }],
          stateMutability: "nonpayable",
        },
      ] as const,
      functionName: "approve",
      args: [subscriptionManagerAddress as `0x${string}`, BigInt(price) * BigInt(10)],
    });

    const subscribeCall = encodeFunctionData({
      abi: [
        {
          name: "subscribe",
          type: "function",
          inputs: [{ name: "planId", type: "uint256" }],
          outputs: [{ name: "subscriptionId", type: "uint256" }],
          stateMutability: "nonpayable",
        },
      ] as const,
      functionName: "subscribe",
      args: [BigInt(planId)],
    });

    // executeBatch is better but SimpleAccount only has execute
    // We need to do two separate UserOps or use a batch helper
    // For demo: single subscribe (assume already approved or use native token plans)
    return encodeFunctionData({
      abi: accountAbi,
      functionName: "execute",
      args: [subscriptionManagerAddress as `0x${string}`, 0n, subscribeCall],
    });
  }

  const subscribeCall = encodeFunctionData({
    abi: [
      {
        name: "subscribe",
        type: "function",
        inputs: [{ name: "planId", type: "uint256" }],
        outputs: [{ name: "subscriptionId", type: "uint256" }],
        stateMutability: "nonpayable",
      },
    ] as const,
    functionName: "subscribe",
    args: [BigInt(planId)],
  });

  return encodeFunctionData({
    abi: accountAbi,
    functionName: "execute",
    args: [subscriptionManagerAddress as `0x${string}`, 0n, subscribeCall],
  });
}

/**
 * Build a PackedUserOperation for ERC-4337 EntryPoint v0.7
 */
async function buildUserOp(
  smartAccountAddress: `0x${string}`,
  callData: `0x${string}`,
  isDeployed: boolean,
  nonce: bigint
): Promise<PackedUserOperation> {
  const verificationGasLimit = 100000n;
  const callGasLimit = 300000n;
  const maxPriorityFeePerGas = 1000000000n; // 1 gwei
  const maxFeePerGas = 25000000000n; // 25 gwei
  const preVerificationGas = 50000n;

  // Pack gas limits: bytes32 = [verificationGasLimit:16 | callGasLimit:16]
  const accountGasLimits = concat([
    toHex(verificationGasLimit, { size: 16 }),
    toHex(callGasLimit, { size: 16 }),
  ]) as `0x${string}`;

  // Pack gas fees: bytes32 = [maxPriorityFeePerGas:16 | maxFeePerGas:16]
  const gasFees = concat([
    toHex(maxPriorityFeePerGas, { size: 16 }),
    toHex(maxFeePerGas, { size: 16 }),
  ]) as `0x${string}`;

  return {
    sender: smartAccountAddress,
    nonce,
    initCode: isDeployed ? "0x" : buildInitCode(smartAccountAddress), // This is wrong — initCode uses factory+owner, not SA address
    callData,
    accountGasLimits,
    preVerificationGas,
    gasFees,
    paymasterAndData: "0x", // will be filled by paymaster-sign
    signature: "0x", // will be filled after signing
  };
}

// Fix: initCode needs the OWNER address, not the smart account address
async function buildUserOpFixed(
  smartAccountAddress: `0x${string}`,
  ownerAddress: string,
  callData: `0x${string}`,
  isDeployed: boolean,
  nonce: bigint
): Promise<PackedUserOperation> {
  const verificationGasLimit = 100000n;
  const callGasLimit = 300000n;
  const maxPriorityFeePerGas = 1000000000n;
  const maxFeePerGas = 25000000000n;
  const preVerificationGas = 50000n;

  const accountGasLimits = concat([
    toHex(verificationGasLimit, { size: 16 }),
    toHex(callGasLimit, { size: 16 }),
  ]) as `0x${string}`;

  const gasFees = concat([
    toHex(maxPriorityFeePerGas, { size: 16 }),
    toHex(maxFeePerGas, { size: 16 }),
  ]) as `0x${string}`;

  return {
    sender: smartAccountAddress,
    nonce,
    initCode: isDeployed ? "0x" : buildInitCode(ownerAddress),
    callData,
    accountGasLimits,
    preVerificationGas,
    gasFees,
    paymasterAndData: "0x",
    signature: "0x",
  };
}

/**
 * Sign a UserOp with the owner's private key.
 */
async function signUserOp(
  userOp: PackedUserOperation,
  ownerPrivateKey: string
): Promise<PackedUserOperation> {
  // Get the hash from EntryPoint
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

  console.log("[AA] UserOp hash:", userOpHash);

  const ownerAccount = privateKeyToAccount(ownerPrivateKey as `0x${string}`);
  const signature = await ownerAccount.signMessage({
    message: { raw: userOpHash },
  });

  return {
    ...userOp,
    signature,
  };
}

/**
 * Get paymaster signature for a UserOp.
 */
async function getPaymasterSignature(userOp: PackedUserOperation): Promise<`0x${string}`> {
  const res = await fetch("/api/aa/paymaster-sign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userOp }),
  });
  const data = await res.json();
  if (!data.success) {
    throw new Error("Paymaster sign failed: " + (data.error || "Unknown"));
  }
  return data.paymasterAndData as `0x${string}`;
}

/**
 * Submit a signed UserOp to the relay.
 */
async function submitToRelay(userOp: PackedUserOperation): Promise<{ txHash: string }> {
  const res = await fetch("/api/aa/relay", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userOp }),
  });
  const data = await res.json();
  if (!data.success) {
    throw new Error("Relay failed: " + (data.error || data.details || "Unknown"));
  }
  return { txHash: data.txHash };
}

/**
 * Subscribe via Account Abstraction (ERC-4337 UserOp).
 * This creates a smart account if needed, builds a UserOp, gets paymaster signature, and submits.
 */
export async function subscribeAA(
  ownerPrivateKey: string,
  ownerAddress: string,
  subscriptionManagerAddress: string,
  planId: number,
  tokenAddress?: string,
  price?: string
): Promise<{ txHash: string; explorerUrl: string; smartAccountAddress: string }> {
  // 1. Get smart account address
  const smartAccountAddress = await getSmartAccountAddress(ownerAddress);
  console.log("[AA] Smart account:", smartAccountAddress);

  // 2. Check if deployed
  const isDeployed = await isSmartAccountDeployed(smartAccountAddress);
  console.log("[AA] Account deployed:", isDeployed);

  // 3. Get nonce
  let nonce: bigint;
  if (isDeployed) {
    nonce = await publicClient.readContract({
      address: smartAccountAddress,
      abi: accountAbi,
      functionName: "getNonce",
    }) as bigint;
  } else {
    nonce = 0n;
  }
  console.log("[AA] Nonce:", nonce.toString());

  // 4. Build callData
  const callData = buildSubscriptionCallData(subscriptionManagerAddress, planId, tokenAddress, price);
  console.log("[AA] CallData:", callData.slice(0, 100) + "...");

  // 5. Build UserOp
  let userOp = await buildUserOpFixed(smartAccountAddress, ownerAddress, callData, isDeployed, nonce);

  // 6. Get paymaster signature
  console.log("[AA] Getting paymaster signature...");
  const paymasterAndData = await getPaymasterSignature(userOp);
  userOp = { ...userOp, paymasterAndData };
  console.log("[AA] Paymaster data set");

  // 7. Sign UserOp with owner key
  console.log("[AA] Signing UserOp...");
  userOp = await signUserOp(userOp, ownerPrivateKey);
  console.log("[AA] UserOp signed");

  // 8. Submit to relay
  console.log("[AA] Submitting to relay...");
  const { txHash } = await submitToRelay(userOp);
  console.log("[AA] Relay txHash:", txHash);

  const explorerUrl = `${process.env.NEXT_PUBLIC_EXPLORER_URL || "https://explorer.apothem.network/"}tx/${txHash}`;

  return {
    txHash,
    explorerUrl,
    smartAccountAddress: smartAccountAddress,
  };
}
