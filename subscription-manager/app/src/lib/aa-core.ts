import {
  createPublicClient,
  http,
  keccak256,
  encodePacked,
  concat,
  toHex,
  encodeFunctionData,
  encodeAbiParameters,
  parseAbi,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

const RPC_URL = process.env.NEXT_PUBLIC_APOTHEM_RPC_URL || "https://erpc.apothem.network";
const CHAIN_ID = 51;
const ENTRYPOINT = (process.env.NEXT_PUBLIC_ENTRYPOINT_ADDRESS || "0x0000000071727De22E5E9d8BAf0edAc6f37da032") as `0x${string}`;
const FACTORY = (process.env.NEXT_PUBLIC_SIMPLE_ACCOUNT_FACTORY_ADDRESS || "0x91E60e0613810449d098b0b5Ec8b51A0FE8c8985") as `0x${string}`;
const SPONSOR_PAYMASTER = (process.env.NEXT_PUBLIC_PAYMASTER_ADDRESS || "0x8361Fae5A25e71C2E1db35cDE13E7150bB7b1a42") as `0x${string}`;
const TOKEN_PAYMASTER = (process.env.NEXT_PUBLIC_TOKEN_PAYMASTER_ADDRESS || "0x17D390EdEb894d8c8B5cD5e6fD47Db923CB4A2c4") as `0x${string}`;

const publicClient = createPublicClient({ transport: http(RPC_URL) });

export type GasMode = "sponsor" | "erc20";

export type PackedUserOp = {
  sender: `0x${string}`;
  nonce: bigint;
  initCode: `0x${string}`;
  callData: `0x${string}`;
  accountGasLimits: `0x${string}`;
  preVerificationGas: bigint;
  gasFees: `0x${string}`;
  paymasterAndData: `0x${string}`;
  signature: `0x${string}`;
};

// ── Smart Account Address ──

export async function getCounterFactualAddress(owner: `0x${string}`): Promise<`0x${string}`> {
  return (await publicClient.readContract({
    address: FACTORY,
    abi: parseAbi(["function getAddress(address owner, uint256 salt) view returns (address)"]),
    functionName: "getAddress",
    args: [owner, 0n],
  })) as `0x${string}`;
}

// ── Nonce ──

export async function getNonce(sender: `0x${string}`): Promise<bigint> {
  return await publicClient.readContract({
    address: ENTRYPOINT,
    abi: parseAbi(["function getNonce(address sender, uint192 key) view returns (uint256)"]),
    functionName: "getNonce",
    args: [sender, 0n],
  });
}

// ── Init Code ──

export function buildInitCode(owner: `0x${string}`): `0x${string}` {
  const createData = encodeFunctionData({
    abi: parseAbi(["function createAccount(address owner, uint256 salt) returns (address)"]),
    functionName: "createAccount",
    args: [owner, 0n],
  });
  return concat([FACTORY, createData]);
}

// ── Gas Packing ──

export function packAccountGasLimits(verificationGasLimit: bigint, callGasLimit: bigint): `0x${string}` {
  return toHex((verificationGasLimit << 128n) | callGasLimit, { size: 32 });
}

export function packGasFees(maxPriorityFeePerGas: bigint, maxFeePerGas: bigint): `0x${string}` {
  return toHex((maxPriorityFeePerGas << 128n) | maxFeePerGas, { size: 32 });
}

// ── UserOp Hash ──

export function getUserOpHash(userOp: PackedUserOp): `0x${string}` {
  const innerHash = keccak256(encodeAbiParameters(
    [
      { type: "address" },
      { type: "uint256" },
      { type: "bytes32" },
      { type: "bytes32" },
      { type: "bytes32" },
      { type: "uint256" },
      { type: "bytes32" },
      { type: "bytes32" },
    ],
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
  ));

  return keccak256(encodeAbiParameters(
    [
      { type: "bytes32" },
      { type: "address" },
      { type: "uint256" },
    ],
    [innerHash, ENTRYPOINT, BigInt(CHAIN_ID)]
  ));
}

// ── Single call wrapper ──

export function buildExecuteCallData(
  target: `0x${string}`,
  innerCallData: `0x${string}`,
): `0x${string}` {
  return encodeFunctionData({
    abi: parseAbi(["function execute(address target, uint256 value, bytes calldata data) external"]),
    functionName: "execute",
    args: [target, 0n, innerCallData],
  });
}

// ── Batch call wrapper ──

export function buildExecuteBatchCallData(
  targets: `0x${string}`[],
  values: bigint[],
  datas: `0x${string}`[],
): `0x${string}` {
  return encodeFunctionData({
    abi: parseAbi(["function executeBatch(address[] calldata dest, uint256[] calldata value, bytes[] calldata func) external"]),
    functionName: "executeBatch",
    args: [targets, values, datas],
  });
}

// ── Sign UserOp ──

export async function signUserOp(privateKey: `0x${string}`, userOp: PackedUserOp): Promise<`0x${string}`> {
  const account = privateKeyToAccount(privateKey);
  const hash = getUserOpHash(userOp);
  const signature = await account.signMessage({ message: { raw: hash } });
  return signature;
}

// ── Get Paymaster Signature (Sponsor Mode) ──

async function getSponsorPaymasterSignature(userOp: PackedUserOp): Promise<`0x${string}`> {
  const res = await fetch("/api/paymaster/sign", {
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

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Paymaster signing failed");
  }

  const data = await res.json();
  return data.paymasterAndData as `0x${string}`;
}

// ── Build ERC-20 PaymasterAndData ──

function buildTokenPaymasterAndData(tokenAddress: `0x${string}`): `0x${string}` {
  // Format: paymaster(20) + verificationGasLimit(16) + postOpGasLimit(16) + token(20)
  const verificationGasLimit = toHex(150000n, { size: 16 });
  const postOpGasLimit = toHex(50000n, { size: 16 });
  return concat([TOKEN_PAYMASTER, verificationGasLimit, postOpGasLimit, tokenAddress]);
}

function serializeUserOp(userOp: PackedUserOp) {
  return {
    ...userOp,
    nonce: userOp.nonce.toString(),
    preVerificationGas: userOp.preVerificationGas.toString(),
  };
}

// ── Send to Bundler ──

async function sendToBundler(userOp: PackedUserOp, mode: GasMode): Promise<{ userOpHash: string; txHash?: string }> {
  console.log("[AA-CORE] Sending UserOp:", JSON.stringify({
    sender: userOp.sender,
    nonce: userOp.nonce.toString(),
    mode,
    paymasterAndDataLength: userOp.paymasterAndData.length,
  }, null, 2));

  const res = await fetch("/api/bundler/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userOp: serializeUserOp(userOp), mode }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || `Bundler error: ${res.status}`);
  }

  const data = await res.json();
  if (!data.success) {
    throw new Error(data.error || "Bundler submission failed");
  }

  return { userOpHash: data.userOpHash, txHash: data.txHash };
}

// ── Build & Submit ──

export async function submitUserOp({
  privateKey,
  callData,
  mode,
  tokenAddress,
  nonce: providedNonce,
}: {
  privateKey: `0x${string}`;
  callData: `0x${string}`;
  mode: GasMode;
  tokenAddress?: `0x${string}`;
  nonce?: bigint;
}): Promise<{ txHash: string; userOpHash: string }> {
  const account = privateKeyToAccount(privateKey);
  const owner = account.address;

  // 1. Get smart account address
  const sender = await getCounterFactualAddress(owner);

  // 2. Get nonce
  const nonce = providedNonce !== undefined ? providedNonce : await getNonce(sender);

  // 3. Check if account deployed
  const code = await publicClient.getBytecode({ address: sender });
  const initCode = code && code.length > 2 ? "0x" : buildInitCode(owner);

  // 4. Estimate gas
  const hasInitCode = initCode && initCode.length > 2;
  const verificationGasLimit = hasInitCode ? 500000n : 150000n;
  const callGasLimit = 300000n;
  const maxFeePerGas = 1000000000n;
  const maxPriorityFeePerGas = 1000000000n;
  const preVerificationGas = hasInitCode ? 100000n : 50000n;

  // 5. Build UserOp
  let userOp: PackedUserOp = {
    sender,
    nonce,
    initCode,
    callData,
    accountGasLimits: packAccountGasLimits(verificationGasLimit, callGasLimit),
    preVerificationGas,
    gasFees: packGasFees(maxPriorityFeePerGas, maxFeePerGas),
    paymasterAndData: "0x",
    signature: "0x",
  };

  // 6. Attach paymaster based on mode
  if (mode === "sponsor") {
    userOp.paymasterAndData = await getSponsorPaymasterSignature(userOp);
  } else if (mode === "erc20") {
    if (!tokenAddress) throw new Error("tokenAddress required for erc20 mode");
    userOp.paymasterAndData = buildTokenPaymasterAndData(tokenAddress);
  }

  // 7. Sign
  const signature = await signUserOp(privateKey, userOp);
  userOp = { ...userOp, signature };

  // 8. Log pre-flight
  console.log("[AA-CORE] Pre-flight UserOp:", {
    sender: userOp.sender,
    nonce: userOp.nonce.toString(),
    mode,
    paymasterAndData: userOp.paymasterAndData,
    paymasterEmpty: userOp.paymasterAndData === "0x",
  });

  // 9. Send to bundler
  const result = await sendToBundler(userOp, mode);

  if (!result.txHash) {
    throw new Error("UserOp submitted but no txHash returned. UserOpHash: " + result.userOpHash);
  }

  return { txHash: result.txHash, userOpHash: result.userOpHash };
}
