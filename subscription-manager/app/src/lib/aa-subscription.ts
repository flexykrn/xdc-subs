import { createPublicClient, encodeFunctionData, http, parseAbi } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { submitUserOp, getCounterFactualAddress, getNonce, buildExecuteCallData, buildExecuteBatchCallData, type GasMode } from "@/lib/aa-core";

const RPC_URL = process.env.NEXT_PUBLIC_APOTHEM_RPC_URL || "https://erpc.apothem.network";
const publicClient = createPublicClient({ transport: http(RPC_URL) });

const TOKEN_PAYMASTER = process.env.NEXT_PUBLIC_TOKEN_PAYMASTER_ADDRESS as `0x${string}`;
if (!TOKEN_PAYMASTER || TOKEN_PAYMASTER === "0x") {
  throw new Error("NEXT_PUBLIC_TOKEN_PAYMASTER_ADDRESS not set in environment");
}

const subscriptionManagerAbi = parseAbi([
  "function subscribe(uint256 planId) returns (uint256 subscriptionId)",
  "function renew(uint256 subscriptionId)",
  "function pause(uint256 subscriptionId)",
  "function cancel(uint256 subscriptionId)",
]);

const erc20Abi = parseAbi([
  "function approve(address spender, uint256 amount) returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
]);

const subscriptionManagerReadAbi = parseAbi([
  "function plans(uint256) view returns (uint256 price, uint256 interval, address tokenAddress, bool active)",
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
  smartAccountAddress?: string,
): Promise<{ userOpHash: string; txHash: string }> {
  const owner = privateKeyToAccount(privateKey as `0x${string}`).address;
  const sa = smartAccountAddress ? smartAccountAddress as `0x${string}` : await getCounterFactualAddress(owner);

  // Always trust on-chain plan config over frontend values.
  const plan = await publicClient.readContract({
    address: contractAddress as `0x${string}`,
    abi: subscriptionManagerReadAbi,
    functionName: "plans",
    args: [BigInt(planId)],
  });

  const onChainPrice = plan[0] as bigint;
  const onChainToken = plan[2] as `0x${string}`;
  const onChainActive = plan[3] as boolean;

  if (!onChainActive) {
    throw new Error("Selected plan is not active on-chain.");
  }

  // For safety, use token configured in contract even if frontend passed another one.
  const effectiveToken = onChainToken;

  // SubscriptionManager charges the Smart Account (msg.sender), not the EOA.
  // Frontend already checked balance; skip redundant on-chain check to avoid SA address mismatches.
  console.log(`[AA-SUB] Using SA: ${sa}, Token: ${effectiveToken}, PlanPrice: ${onChainPrice.toString()}`);

  // For ERC20 mode: check and auto-approve paymaster first
  if (mode === "erc20") {
    const needsApproval = await checkPaymasterApproval(sa, effectiveToken);
    if (needsApproval) {
      console.log("[AA-SUB] Auto-approving TokenPaymaster...");
      const approvePmData = encodeFunctionData({
        abi: erc20Abi,
        functionName: "approve",
        args: [TOKEN_PAYMASTER, BigInt("999999999999999999999999999")],
      });
      const executeApprove = buildExecuteCallData(effectiveToken, approvePmData);
      
      const nonce = await getNonce(sa);
      const approveResult = await submitUserOp({
        privateKey: privateKey as `0x${string}`,
        callData: executeApprove,
        mode: "sponsor",
        nonce,
        sender: sa,
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

  // 1. Approve SubscriptionManager with a high allowance so
  // on-chain plan price changes do not break frontend-driven amount assumptions.
  if (effectiveToken) {
    const approveSubData = encodeFunctionData({
      abi: erc20Abi,
      functionName: "approve",
      args: [contractAddress as `0x${string}`, BigInt("999999999999999999999999999")],
    });
    targets.push(effectiveToken);
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
    tokenAddress: effectiveToken,
    nonce,
    sender: sa,
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
  smartAccountAddress?: string,
): Promise<{ userOpHash: string; txHash: string }> {
  const owner = privateKeyToAccount(privateKey as `0x${string}`).address;
  const sa = smartAccountAddress ? smartAccountAddress as `0x${string}` : await getCounterFactualAddress(owner);
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
    sender: sa,
  });

  return result;
}
