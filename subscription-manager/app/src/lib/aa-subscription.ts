import { encodeFunctionData, parseAbi } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { submitUserOp, getCounterFactualAddress, getNonce, buildExecuteCallData, buildExecuteBatchCallData, type GasMode } from "@/lib/aa-core";

const TOKEN_PAYMASTER = (process.env.NEXT_PUBLIC_TOKEN_PAYMASTER_ADDRESS || "0x17D390EdEb894d8c8B5cD5e6fD47Db923CB4A2c4") as `0x${string}`;

const subscriptionManagerAbi = parseAbi([
  "function subscribe(uint256 planId) returns (uint256 subscriptionId)",
  "function renew(uint256 subscriptionId)",
  "function pause(uint256 subscriptionId)",
  "function cancel(uint256 subscriptionId)",
]);

const erc20Abi = parseAbi([
  "function approve(address spender, uint256 amount) returns (bool)",
]);

// ── Batched Subscribe (Approve + Subscribe in ONE UserOp) ──
// For ERC20 mode: if paymaster not approved, auto-approves first via sponsor mode

export async function executeAASubscription(
  privateKey: string,
  contractAddress: string,
  planId: number,
  mode: GasMode = "sponsor",
  tokenAddress?: string,
  price?: string,
): Promise<{ userOpHash: string; txHash: string }> {
  const owner = privateKeyToAccount(privateKey as `0x${string}`).address;
  const sa = await getCounterFactualAddress(owner);

  // For ERC20 mode: check and auto-approve paymaster first
  if (mode === "erc20" && tokenAddress) {
    const needsApproval = await checkPaymasterApproval(sa, tokenAddress as `0x${string}`);
    if (needsApproval) {
      console.log("[AA-SUB] Auto-approving TokenPaymaster...");
      const approvePmData = encodeFunctionData({
        abi: erc20Abi,
        functionName: "approve",
        args: [TOKEN_PAYMASTER, BigInt("999999999999999999999999999")],
      });
      const executeApprove = buildExecuteCallData(tokenAddress as `0x${string}`, approvePmData);
      
      const nonce = await getNonce(sa);
      const approveResult = await submitUserOp({
        privateKey: privateKey as `0x${string}`,
        callData: executeApprove,
        mode: "sponsor",
        nonce,
      });
      console.log("[AA-SUB] Paymaster approved:", approveResult.txHash);
      // Wait a moment for state to update
      await new Promise(r => setTimeout(r, 3000));
    }
  }

  const nonce = await getNonce(sa);

  // Build batch: approve + subscribe in ONE UserOp
  const targets: `0x${string}`[] = [];
  const values: bigint[] = [];
  const datas: `0x${string}`[] = [];

  // 1. Approve SubscriptionManager for subscription price
  if (tokenAddress && price) {
    const approveSubData = encodeFunctionData({
      abi: erc20Abi,
      functionName: "approve",
      args: [contractAddress as `0x${string}`, BigInt(price)],
    });
    targets.push(tokenAddress as `0x${string}`);
    values.push(0n);
    datas.push(approveSubData);
  }

  // 2. Subscribe call
  const subscribeData = encodeFunctionData({
    abi: subscriptionManagerAbi,
    functionName: "subscribe",
    args: [BigInt(planId)],
  });
  targets.push(contractAddress as `0x${string}`);
  values.push(0n);
  datas.push(subscribeData);

  // 3. Wrap in executeBatch for SimpleAccount
  const batchCallData = buildExecuteBatchCallData(targets, values, datas);

  // 4. Submit as single UserOp
  const result = await submitUserOp({
    privateKey: privateKey as `0x${string}`,
    callData: batchCallData,
    mode,
    tokenAddress: tokenAddress as `0x${string}`,
    nonce,
  });

  return result;
}

async function checkPaymasterApproval(sa: `0x${string}`, tokenAddress: `0x${string}`): Promise<boolean> {
  try {
    const res = await fetch(process.env.NEXT_PUBLIC_APOTHEM_RPC_URL || "https://erpc.apothem.network", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_call",
        params: [{
          to: tokenAddress,
          data: `0xdd62ed3e${sa.slice(2).padStart(64, "0")}${TOKEN_PAYMASTER.slice(2).padStart(64, "0")}`
        }, "latest"]
      })
    });
    const data = await res.json();
    if (data.result) {
      return BigInt(data.result) === 0n;
    }
    return true; // assume needs approval if can't check
  } catch {
    return true;
  }
}

// ── Lifecycle Actions (single call per UserOp) ──

export async function executeAALifecycle(
  privateKey: string,
  contractAddress: string,
  subscriptionId: number,
  action: "renew" | "pause" | "cancel",
  mode: GasMode = "sponsor",
  tokenAddress?: string,
  price?: string,
): Promise<{ userOpHash: string; txHash: string }> {
  const owner = privateKeyToAccount(privateKey as `0x${string}`).address;
  const sa = await getCounterFactualAddress(owner);
  const nonce = await getNonce(sa);

  const actionData = encodeFunctionData({
    abi: subscriptionManagerAbi,
    functionName: action,
    args: [BigInt(subscriptionId)],
  });

  const callData = buildExecuteCallData(contractAddress as `0x${string}`, actionData);

  const result = await submitUserOp({
    privateKey: privateKey as `0x${string}`,
    callData,
    mode,
    tokenAddress: tokenAddress as `0x${string}`,
    nonce,
  });

  return result;
}
