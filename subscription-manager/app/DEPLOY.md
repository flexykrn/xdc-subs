# Deploy to Vercel

## Quick Deploy (2 minutes)

The app is ready to deploy. Follow these steps:

### Step 1: Login to Vercel
```bash
cd C:\Users\karan\.openclaw\workspace\subscription-manager\subscription-manager\app
vercel login
# Follow the browser prompt to authenticate
```

### Step 2: Deploy
```bash
vercel --prod
```

This will:
- Upload the app to Vercel
- Install dependencies
- Build the project
- Deploy to a live URL

### Step 3: Environment Variables
After first deploy, add these env vars in Vercel Dashboard:
- `NEXT_PUBLIC_WEB3AUTH_CLIENT_ID`
- `NEXT_PUBLIC_ARKA_API_KEY`
- `NEXT_PUBLIC_BUNDLER_URL`
- `NEXT_PUBLIC_APOTHEM_RPC_URL`
- `NEXT_PUBLIC_CHAIN_ID`
- `NEXT_PUBLIC_SUBSCRIPTION_MANAGER_ADDRESS`
- `NEXT_PUBLIC_TOKEN_A_ADDRESS`
- `NEXT_PUBLIC_TOKEN_B_ADDRESS`
- `NEXT_PUBLIC_EXPLORER_URL`

Or run:
```bash
vercel env add NEXT_PUBLIC_WEB3AUTH_CLIENT_ID
# (repeat for each env var)
```

---

## What's Working

### ✅ Working Features
- **Web3Auth Login** — Google/Twitter/Discord → MPC wallet → real private key
- **Token Balances** — Real ERC20 balances from blockchain
- **Plans Page** — Active/inactive status verified from chain
- **Subscribe Flow** — EOA fallback when Etherspot factory not deployed
- **Transaction Submission** — Real on-chain transactions via direct EOA
- **Auth Guards** — All pages protected except home/plans
- **History** — Real telemetry data (user-specific)
- **Lifecycle** — Real subscriptions filtered by connected wallet

### ⚠️ Known Limitations
- Etherspot factory not deployed on XDC Apothem → Smart account shows "compute pending"
- Transactions work via EOA fallback (still real on-chain txs)
- History comes from telemetry/localStorage (not blockchain scan)

### 🎯 For Investor Demo
1. Connect wallet → show real balances
2. Browse plans → show live on-chain status
3. Subscribe → transaction submits to blockchain
4. View in lifecycle → real subscription appears
5. History → transaction logged

---

## Build Status
- **Last Build:** ✅ PASSED
- **All Pages:** 19 routes compile
- **TypeScript:** No errors
- **Ready for deploy:** YES
