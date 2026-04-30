# Deploy to Render

## Method 1: Blueprint Deploy (Easiest)

1. Push this repo to GitHub
2. Go to [render.com](https://render.com) → Blueprint
3. Connect your GitHub repo
4. Render will read the root `render.yaml` and auto-configure the service with `rootDir: subscription-manager/app`
5. Add environment variables in Render Dashboard:
   - `NEXT_PUBLIC_WEB3AUTH_CLIENT_ID`
   - `NEXT_PUBLIC_ARKA_API_KEY`
   - `NEXT_PUBLIC_BUNDLER_URL`
   - `NEXT_PUBLIC_SUBSCRIPTION_MANAGER_ADDRESS`
   - `NEXT_PUBLIC_NETFLIX_TOKEN_ADDRESS`
   - `NEXT_PUBLIC_SPOTIFY_TOKEN_ADDRESS`
   - `NEXT_PUBLIC_YOUTUBE_TOKEN_ADDRESS`
   - `NEXT_PUBLIC_JIOHOTSTAR_TOKEN_ADDRESS`
   - `NEXT_PUBLIC_CLAUDE_TOKEN_ADDRESS`
   - `NEXT_PUBLIC_COPILOT_TOKEN_ADDRESS`

## Method 2: Manual Web Service

1. Push repo to GitHub
2. Render Dashboard → New → Web Service
3. Connect repo
4. Settings:
   - **Root Directory:** `subscription-manager/app`
   - **Build Command:** `npm ci && npm run build`
   - **Start Command:** `npm run start`
   - **Plan:** Free
5. Add environment variables (same as above)

## Environment Variables Required

```
NEXT_PUBLIC_WEB3AUTH_CLIENT_ID=your_web3auth_client_id
NEXT_PUBLIC_ARKA_API_KEY=etherspot_AA2QUX5f6tqxLEA8hC7XQu
NEXT_PUBLIC_BUNDLER_URL=https://your-bundler-host/v1/51?api-key=YOUR_API_KEY_HERE
NEXT_PUBLIC_APOTHEM_RPC_URL=https://erpc.apothem.network
NEXT_PUBLIC_CHAIN_ID=51
NEXT_PUBLIC_SUBSCRIPTION_MANAGER_ADDRESS=0x666CeAF3c04Ed1eFbb84c3F140e8CDc18013c30e
NEXT_PUBLIC_NETFLIX_TOKEN_ADDRESS=0x896F79883Bf0620Afcd3D8942f1Db8d3F447AE84
NEXT_PUBLIC_SPOTIFY_TOKEN_ADDRESS=0x9F00925759A9F0FEb13373336B761A7267AE66a9
NEXT_PUBLIC_YOUTUBE_TOKEN_ADDRESS=0x591CCebbd943a2F9a11F64eBf627d86600a0f38e
NEXT_PUBLIC_JIOHOTSTAR_TOKEN_ADDRESS=0x87CB2de7edc1B9D725a5a6DeDdcbEF7e36fe3084
NEXT_PUBLIC_CLAUDE_TOKEN_ADDRESS=0xA228078133e812677533166A44187c1Ae696687A
NEXT_PUBLIC_COPILOT_TOKEN_ADDRESS=0x4c4456bF7A0e572D2C697626025DcB6d3D3Df7D1
# Optional compatibility vars (if any page still reads these)
NEXT_PUBLIC_TOKEN_A_ADDRESS=0xBE078Bb770739011F1F72Ce5d096ABa113a4e2dC
NEXT_PUBLIC_TOKEN_B_ADDRESS=0xAE60A4f21eE53f37447aa7F0F4b73E6a09a159C4
NEXT_PUBLIC_EXPLORER_URL=https://explorer.apothem.network/
FAUCET_PRIVATE_KEY=0x...
KEEPER_PRIVATE_KEY=0x...
```

## What's Working

- ✅ Web3Auth social login (Google/Twitter/Discord)
- ✅ Real MPC wallet with private key
- ✅ Token balances from blockchain
- ✅ Plan status from smart contract
- ✅ Subscribe transactions (EOA fallback when AA unavailable)
- ✅ Transaction polling for confirmation
- ✅ Auth guards on all pages
- ✅ Responsive design

## Known Limitations

- Etherspot factory not on XDC Apothem → Smart account shows "compute pending"
- Transactions work via EOA fallback (still real on-chain)
- History from telemetry (not blockchain scan)

---

**Build Status:** ✅ Passing | **TypeScript:** ✅ No errors | **Ready:** ✅ Yes
