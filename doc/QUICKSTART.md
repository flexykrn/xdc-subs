# Quickstart & Reproduction Guide

## Decentralized Subscription Manager — ERC-4337 Account Abstraction on XDC Apothem

---

### 1. PROJECT OVERVIEW & TECH STACK

A decentralized subscription platform where users pay for services using ERC-20 tokens via ERC-4337 Smart Accounts. Gas fees are abstracted — users either get sponsored gas (gasless) or pay gas using the same ERC-20 tokens they're using for subscriptions.

**Tech Stack:**
- **Frontend:** Next.js 16 + React 19 + Tailwind CSS
- **Signer:** Web3Auth (Social Login → EOA generation)
- **Smart Account:** ERC-4337 SimpleAccount (via custom factory)
- **Bundler:** Custom in-app bundler (our own `/api/bundler/submit` endpoint)
- **Paymasters:** 
  - VerifyingSponsorPaymaster (gasless mode)
  - ERC-20 TokenPaymaster (pay gas with tokens)
- **Network:** XDC Apothem Testnet (Chain ID 51)

**Important Note on Etherspot:** We initially attempted Etherspot Prime SDK + Skandha Bundler + Arka Paymaster. However, **Etherspot's hosted endpoints do not support XDC Apothem (chain 51)** — their API returns `400 Unsupported network` and `500 RPC request could not be processed`. This is confirmed by their own dashboard showing zero usage. We built a custom bundler and paymaster solution instead.

---

### 2. REQUIRED APIs & ACCOUNT SETUP

| Service | Purpose | Exact Value |
|---------|---------|-------------|
| **Web3Auth** | Social login → EOA generation | Client ID: `BKOTDTlPEoBRmDtdavulY64IIcmUXpzK9PQIknjl33NB9NnayoYsrl3n5VLj8p56pcDKLJ1eaH5AHWhOIFY3WT4` |
| **XDC RPC** | Read blockchain state | `https://erpc.apothem.network` |
| **Bundler** | Submit UserOps to EntryPoint | **Custom**: In-app API route `/api/bundler/submit` (not Etherspot) |
| **Paymaster** | Sign sponsor UserOps | **Custom**: In-app API route `/api/paymaster/sign` (not Arka) |
| **Explorer** | Verify transactions | `https://testnet.xdcscan.com/` |

**Note:** No third-party bundler or paymaster API keys are required. Our custom infrastructure handles everything.

---

### 3. EXACT CONTRACT ADDRESSES (XDC APOTHEM TESTNET)

| Contract | Address | Purpose |
|----------|---------|---------|
| **EntryPoint v0.7** | `0x0000000071727De22E5E9d8BAf0edAc6f37da032` | ERC-4337 EntryPoint (standard) |
| **SimpleAccountFactory** | `0x91E60e0613810449d098b0b5Ec8b51A0FE8c8985` | Creates Smart Accounts |
| **SubscriptionManager** | `0xe8271C9Bc2255A41cd2AB53FbfB69CE4B5f3032E` | Core subscription contract |
| **VerifyingSponsorPaymaster** | `0x8361Fae5A25e71C2E1db35cDE13E7150bB7b1a42` | Gasless mode paymaster |
| **TokenPaymaster** | `0x17D390EdEb894d8c8B5cD5e6fD47Db923CB4A2c4` | ERC-20 gas paymaster |

**ERC-20 Token Addresses:**

| Service | Token Symbol | Address |
|---------|-------------|---------|
| Netflix | NFX | `0x896F79883Bf0620Afcd3D8942f1Db8d3F447AE84` |
| Spotify | SPF | `0x9F00925759A9F0FEb13373336B761A7267AE66a9` |
| YouTube | YTB | `0x591CCebbd943a2F9a11F64eBf627d86600a0f38e` |
| JioHotstar | JHS | `0x87CB2de7edc1B9D725a5a6DeDdcbEF7e36fe3084` |
| Claude Code | CLD | `0xA228078133e812677533166A44187c1Ae696687A` |
| Copilot | CPT | `0x4c4456bF7A0e572D2C697626025DcB6d3D3Df7D1` |

**Deployer/Bundler/Paymaster Owner Address:** `0x8916DD1311c17aD008bB56bE3378E001a92e4375`

---

### 4. THE .env.local BLUEPRINT

Copy this exactly into `subscription-manager/app/.env.local`:

```bash
# Web3Auth
NEXT_PUBLIC_WEB3AUTH_CLIENT_ID=BKOTDTlPEoBRmDtdavulY64IIcmUXpzK9PQIknjl33NB9NnayoYsrl3n5VLj8p56pcDKLJ1eaH5AHWhOIFY3WT4

# XDC Apothem Network
NEXT_PUBLIC_APOTHEM_RPC_URL=https://erpc.apothem.network
NEXT_PUBLIC_CHAIN_ID=51
NEXT_PUBLIC_EXPLORER_URL=https://testnet.xdcscan.com/

# ERC-4337 Infrastructure
NEXT_PUBLIC_ENTRYPOINT_ADDRESS=0x0000000071727De22E5E9d8BAf0edAc6f37da032
NEXT_PUBLIC_SIMPLE_ACCOUNT_FACTORY_ADDRESS=0x91E60e0613810449d098b0b5Ec8b51A0FE8c8985
NEXT_PUBLIC_SUBSCRIPTION_MANAGER_ADDRESS=0xe8271C9Bc2255A41cd2AB53FbfB69CE4B5f3032E

# Paymasters
NEXT_PUBLIC_PAYMASTER_ADDRESS=0x8361Fae5A25e71C2E1db35cDE13E7150bB7b1a42
NEXT_PUBLIC_TOKEN_PAYMASTER_ADDRESS=0x17D390EdEb894d8c8B5cD5e6fD47Db923CB4A2c4

# ERC-20 Token Addresses
NEXT_PUBLIC_NETFLIX_TOKEN_ADDRESS=0x896F79883Bf0620Afcd3D8942f1Db8d3F447AE84
NEXT_PUBLIC_SPOTIFY_TOKEN_ADDRESS=0x9F00925759A9F0FEb13373336B761A7267AE66a9
NEXT_PUBLIC_YOUTUBE_TOKEN_ADDRESS=0x591CCebbd943a2F9a11F64eBf627d86600a0f38e
NEXT_PUBLIC_JIOHOTSTAR_TOKEN_ADDRESS=0x87CB2de7edc1B9D725a5a6DeDdcbEF7e36fe3084
NEXT_PUBLIC_CLAUDE_TOKEN_ADDRESS=0xA228078133e812677533166A44187c1Ae696687A
NEXT_PUBLIC_COPILOT_TOKEN_ADDRESS=0x4c4456bF7A0e572D2C697626025DcB6d3D3Df7D1

# Server-side secrets (required for bundler + paymaster signing)
BUNDLER_PRIVATE_KEY=your_bundler_private_key_here
PAYMASTER_PRIVATE_KEY=your_paymaster_private_key_here
DEPLOYER_PRIVATE_KEY=your_deployer_private_key_here
FAUCET_PRIVATE_KEY=your_faucet_private_key_here
```

**⚠️ Security Note:** The Web3Auth Client ID above is a test key for SAPPHIRE_DEVNET. For production, replace with your own from the Web3Auth Dashboard. Never commit private keys to git.

---

### 5. CORE LOGIC (CODE SNIPPETS)

#### 5.1 Smart Account Initialization

```typescript
// src/lib/aa-core.ts
const RPC_URL = "https://erpc.apothem.network";
const CHAIN_ID = 51;
const ENTRYPOINT = "0x0000000071727De22E5E9d8BAf0edAc6f37da032";
const FACTORY = "0x91E60e0613810449d098b0b5Ec8b51A0FE8c8985";

export async function getCounterFactualAddress(owner: `0x${string}`): Promise<`0x${string}`> {
  return await publicClient.readContract({
    address: FACTORY,
    abi: parseAbi(["function getAddress(address owner, uint256 salt) view returns (address)"]),
    functionName: "getAddress",
    args: [owner, 0n],
  });
}
```

#### 5.2 UserOp Construction & Paymaster Attachment

```typescript
// src/lib/aa-core.ts — submitUserOp
export async function submitUserOp({
  privateKey, callData, mode, tokenAddress, nonce
}: {
  privateKey: `0x${string}`;
  callData: `0x${string}`;
  mode: "sponsor" | "erc20";
  tokenAddress?: `0x${string}`;
  nonce?: bigint;
}): Promise<{ txHash: string; userOpHash: string }> {
  const account = privateKeyToAccount(privateKey);
  const owner = account.address;
  
  // 1. Derive Smart Account address
  const sender = await getCounterFactualAddress(owner);
  
  // 2. Get nonce from EntryPoint
  const nonce = providedNonce ?? await getNonce(sender);
  
  // 3. Check if SA needs deployment
  const code = await publicClient.getBytecode({ address: sender });
  const initCode = code?.length > 2 ? "0x" : buildInitCode(owner);
  
  // 4. Build UserOp
  let userOp: PackedUserOp = {
    sender, nonce, initCode, callData,
    accountGasLimits: packAccountGasLimits(150000n, 300000n),
    preVerificationGas: initCode.length > 2 ? 100000n : 50000n,
    gasFees: packGasFees(1000000000n, 1000000000n),
    paymasterAndData: "0x",
    signature: "0x",
  };
  
  // 5. Attach paymaster
  if (mode === "sponsor") {
    userOp.paymasterAndData = await getSponsorPaymasterSignature(userOp);
  } else if (mode === "erc20") {
    userOp.paymasterAndData = buildTokenPaymasterAndData(tokenAddress!);
  }
  
  // 6. Sign and submit
  userOp.signature = await signUserOp(privateKey, userOp);
  return await sendToBundler(userOp, mode);
}
```

#### 5.3 Batched Transaction (Approve + Subscribe)

```typescript
// src/lib/aa-subscription.ts — executeAASubscription
export async function executeAASubscription(
  privateKey: string,
  contractAddress: string,
  planId: number,
  mode: "sponsor" | "erc20",
  tokenAddress?: string,
  price?: string,
): Promise<{ userOpHash: string; txHash: string }> {
  const sa = await getCounterFactualAddress(owner);
  
  // For ERC20: auto-approve TokenPaymaster first if needed
  if (mode === "erc20" && tokenAddress) {
    const needsApproval = await checkPaymasterApproval(sa, tokenAddress);
    if (needsApproval) {
      // Send approve via sponsor mode first
      await submitUserOp({ /* approve paymaster */ mode: "sponsor" });
      await new Promise(r => setTimeout(r, 3000));
    }
  }
  
  // Build batch: approve + subscribe
  const targets: `0x${string}`[] = [];
  const values: bigint[] = [];
  const datas: `0x${string}`[] = [];
  
  // 1. Approve SubscriptionManager for tokens
  targets.push(tokenAddress!);
  values.push(0n);
  datas.push(encodeFunctionData({
    abi: erc20Abi,
    functionName: "approve",
    args: [contractAddress, BigInt(price!)],
  }));
  
  // 2. Subscribe call
  targets.push(contractAddress as `0x${string}`);
  values.push(0n);
  datas.push(encodeFunctionData({
    abi: subscriptionManagerAbi,
    functionName: "subscribe",
    args: [BigInt(planId)],
  }));
  
  // 3. Wrap in executeBatch
  const batchCallData = buildExecuteBatchCallData(targets, values, datas);
  
  // 4. Submit as single UserOp
  return await submitUserOp({ privateKey, callData: batchCallData, mode, tokenAddress });
}
```

#### 5.4 Custom Bundler (Server-side EntryPoint.handleOps)

```typescript
// src/app/api/bundler/submit/route.ts
export async function POST(req: NextRequest) {
  const { userOp: rawUserOp, mode } = await req.json();
  
  const userOp: PackedUserOp = {
    sender: rawUserOp.sender,
    nonce: BigInt(rawUserOp.nonce),
    initCode: rawUserOp.initCode,
    callData: rawUserOp.callData,
    accountGasLimits: rawUserOp.accountGasLimits,
    preVerificationGas: BigInt(rawUserOp.preVerificationGas),
    gasFees: rawUserOp.gasFees,
    paymasterAndData: rawUserOp.paymasterAndData,
    signature: rawUserOp.signature,
  };
  
  // Submit directly to EntryPoint.handleOps
  const txHash = await walletClient.writeContract({
    address: ENTRYPOINT,
    abi: entryPointAbi,
    functionName: "handleOps",
    args: [[userOp], bundlerAccount.address],
    gas: 2000000n,
  });
  
  const userOpHash = getUserOpHash(userOp);
  return NextResponse.json({ success: true, txHash, userOpHash });
}
```

---

### 6. IDIOT-PROOF REPRODUCTION STEPS

1. **Clone & Install**
   ```bash
   git clone https://github.com/flexykrn/xdc-subs.git
   cd xdc-subs/subscription-manager/app
   npm install
   ```

2. **Configure Environment**
   Copy the `.env.local` blueprint from Section 4 above into `subscription-manager/app/.env.local`.

3. **Start Dev Server**
   ```bash
   npm run dev
   ```
   Open `http://localhost:3000`

4. **Login via Web3Auth**
   - Click "Connect Wallet"
   - Choose Social Login (Google/Twitter)
   - This generates an EOA and derives the Smart Account address

5. **Get Test Tokens**
   - Navigate to `/faucet`
   - Mint tokens for each service (Netflix, Spotify, etc.)
   - Tokens are sent directly to your Smart Account

6. **Subscribe**
   - Go to `/plans`
   - Select a plan and click Subscribe
   - Choose mode:
     - **Gasless**: Deployer sponsors gas (you pay 0 tXDC)
     - **ERC20 Gas**: Pay gas using service tokens (no tXDC needed)
   - Approve token spend → Confirm

7. **Verify on Explorer**
   - Copy the txHash from the success modal
   - Open `https://testnet.xdcscan.com/tx/{txHash}`
   - Verify:
     - `Subscribed` event emitted
     - Tokens transferred from SA to SubscriptionManager
     - For ERC20 mode: tokens transferred to TokenPaymaster as gas fee

---

### 7. TROUBLESHOOTING COMMON ERRORS

#### AA25: Invalid Account Nonce
**Cause:** Two UserOps used the same nonce. The EntryPoint requires strictly sequential nonces per account.

**Fix:** Read nonce once at the start, then increment manually for subsequent UserOps:
```typescript
const nonce = await getNonce(sa);
// First UserOp uses nonce
// Second UserOp uses nonce + 1n
```

#### AA31: Paymaster Deposit Too Low
**Cause:** The VerifyingPaymaster doesn't have enough tXDC deposited in the EntryPoint to cover gas.

**Fix:** Fund the paymaster via EntryPoint.depositTo():
```javascript
// Fund paymaster with 10 tXDC
await entryPoint.depositTo(paymasterAddress, { value: parseEther("10") });
```
Current VerifyingPaymaster balance: ~104 tXDC ✅

#### AA21: Didn't Pay Prefund (ERC20 Mode)
**Cause:** TokenPaymaster has insufficient deposit in EntryPoint OR the Smart Account has zero token balance.

**Fix:** 
1. Check TokenPaymaster deposit: `entryPoint.getDepositInfo(tokenPaymaster)`
2. Ensure SA has tokens: check token balance of SA address
3. If first-time ERC20: SA must approve TokenPaymaster first (handled automatically by our auto-approval logic)

Current TokenPaymaster deposit: 5 tXDC ✅

#### AA33: Failed to Pay Paymaster
**Cause:** ERC20 paymaster rejected the token. Usually means:
- Token not supported by paymaster
- Token rate is zero
- Token balance insufficient

**Fix:** Ensure the token address is in the paymaster's `supportedTokens` mapping and has a non-zero `tokenRate`.

#### Execution Reverted (Contract Level)
**Cause:** The bundler delivered the UserOp, but the SubscriptionManager contract rejected it.

**Common reasons:**
- Missing token approval to SubscriptionManager (should be in the batch)
- Insufficient token balance
- Plan doesn't exist or is inactive
- Smart Account not deployed (initCode missing)

**Fix:** Check the transaction on xdcscan for the exact revert reason. Ensure the batch includes both `approve` and `subscribe` calls.

---

### 8. ARCHITECTURE SUMMARY

```
User (Web3Auth Social Login)
  ↓
EOA + Private Key
  ↓
Smart Account (ERC-4337 SimpleAccount, counterfactual)
  ↓
UserOp Construction:
  - approve(token, SubscriptionManager, price)
  - subscribe(planId)
  ↓
Paymaster Attachment:
  Sponsor mode: VerifyingPaymaster signature
  ERC20 mode: TokenPaymaster + token address
  ↓
Client Signs UserOp
  ↓
POST /api/bundler/submit
  ↓
Server calls EntryPoint.handleOps(UserOp)
  ↓
On-chain Execution:
  - initCode deploys SA (if first time)
  - paymaster pays gas
  - SA executes batch: approve + subscribe
  - SubscriptionManager emits Subscribed event
  ↓
XDC Apothem Block Confirmation
```

---

### 9. EXPLORER LINKS

- **SubscriptionManager Contract:** https://testnet.xdcscan.com/address/0xe8271C9Bc2255A41cd2AB53FbfB69CE4B5f3032E
- **VerifyingPaymaster:** https://testnet.xdcscan.com/address/0x8361Fae5A25e71C2E1db35cDE13E7150bB7b1a42
- **TokenPaymaster:** https://testnet.xdcscan.com/address/0x17D390EdEb894d8c8B5cD5e6fD47Db923CB4A2c4
- **EntryPoint v0.7:** https://testnet.xdcscan.com/address/0x0000000071727De22E5E9d8BAf0edAc6f37da032

---

*Last updated: 2026-04-30*
