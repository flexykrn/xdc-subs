# Deploy to Render

## Prerequisites

1. **GitHub repo** with this code pushed
2. **Render account** (free tier works)
3. **Web3Auth Client ID** from [dashboard.web3auth.io](https://dashboard.web3auth.io)
4. **Etherspot API Key** from [dashboard.etherspot.io](https://dashboard.etherspot.io)

---

## Step 1: Push to GitHub

```bash
git add .
git commit -m "Ready for Render deployment"
git push origin main
```

---

## Step 2: Create Web Service on Render

1. Go to [render.com](https://render.com) → Dashboard → **New +** → **Web Service**
2. Connect your GitHub repo
3. Render will auto-detect `render.yaml` and pre-fill settings

---

## Step 3: Set Environment Variables

In Render dashboard → your service → **Environment** tab, add these:

### Public vars (NEXT_PUBLIC_*)

| Variable | Value | Where to get |
|----------|-------|--------------|
| `NEXT_PUBLIC_WEB3AUTH_CLIENT_ID` | `BA...` | Web3Auth dashboard |
| `NEXT_PUBLIC_ARKA_API_KEY` | `etherspot_...` | Etherspot dashboard |
| `NEXT_PUBLIC_BUNDLER_URL` | `https://testnet-rpc.etherspot.io/v1/51?api-key=...` | Etherspot dashboard |

### Server-side secrets (NEVER expose these)

| Variable | Value | Notes |
|----------|-------|-------|
| `FAUCET_PRIVATE_KEY` | `0x...` | Deployer wallet — owns token contracts |
| `KEEPER_PRIVATE_KEY` | `0x...` | Fresh wallet with ~10 tXDC for gas |

**How to create KEEPER wallet:**
```bash
# Use any wallet generator or:
npx hardhat node
# Then create a new account, fund it from your deployer
```

---

## Step 4: Deploy

Click **Deploy** in Render. Wait for build (~2-3 minutes).

Build logs should show:
```
✓ Compiled successfully
✓ Generating static pages (21/21)
```

---

## Step 5: Verify

| URL | What to check |
|-----|---------------|
| `https://your-app.onrender.com/` | Homepage loads |
| `https://your-app.onrender.com/plans` | 6 services shown |
| `https://your-app.onrender.com/api/health` | `{"ok":true}` |

---

## Step 6: Test End-to-End

1. Open `/faucet`
2. Connect wallet (Google login)
3. Click "Get All Test Tokens"
4. Go to `/plans` → Netflix → Basic
5. Click Subscribe (🎁 Gasless mode)
6. Check `/dashboard` — subscription appears

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Build fails | Check all env vars are set |
| Faucet returns error | `FAUCET_PRIVATE_KEY` must be deployer wallet |
| Subscribe reverts | User needs tokens — use faucet first |
| "Smart account" shows EOA fallback | Normal on XDC Apothem — Etherspot factory not deployed |
| Auto-renewal not working | Set `KEEPER_PRIVATE_KEY`, fund with tXDC |

---

## Contract Addresses (XDC Apothem)

| Contract | Address |
|----------|---------|
| SubscriptionManager | `0xe8271C9Bc2255A41cd2AB53FbfB69CE4B5f3032E` |
| NetflixToken (NFX) | `0x896F79883Bf0620Afcd3D8942f1Db8d3F447AE84` |
| SpotifyToken (SPF) | `0x9F00925759A9F0FEb13373336B761A7267AE66a9` |
| YouTubeToken (YTB) | `0x591CCebbd943a2F9a11F64eBf627d86600a0f38e` |
| JioHotstarToken (JHS) | `0x87CB2de7edc1B9D725a5a6DeDdcbEF7e36fe3084` |
| ClaudeToken (CLA) | `0xA228078133e812677533166A44187c1Ae696687A` |
| CopilotToken (COP) | `0x4c4456bF7A0e572D2C697626025DcB6d3D3Df7D1` |
