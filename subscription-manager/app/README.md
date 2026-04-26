# AA Subscription Manager

A **decentralized subscription management platform** built with Account Abstraction (ERC-7579) on XDC Network.

## 🚀 One-Click Deploy

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/flexykrn/xdc-subs)

Click the button above, then fill in 5 environment variables in the Render dashboard:

| Variable | Where to Get |
|----------|-------------|
| `NEXT_PUBLIC_WEB3AUTH_CLIENT_ID` | [dashboard.web3auth.io](https://dashboard.web3auth.io) |
| `NEXT_PUBLIC_ARKA_API_KEY` | [etherspot.io](https://etherspot.io) — use key `etherspot_AA2QUX5f6tqxLEA8hC7XQu` |
| `NEXT_PUBLIC_BUNDLER_URL` | Same as above — `https://testnet-rpc.etherspot.io/v1/51?api-key=...` |
| `FAUCET_PRIVATE_KEY` | Your deployer wallet private key (owns token contracts) |
| `KEEPER_PRIVATE_KEY` | Create new wallet, fund with 10 tXDC, paste key |

Contracts, tokens, and RPC are pre-configured in the blueprint.

---

## 🚀 Features

- **Social Login** — Google/Twitter/Discord via Web3Auth MPC
- **Gasless Transactions** — Arka Paymaster sponsors gas fees
- **Smart Accounts** — Etherspot ERC-7579 modular accounts (EOA fallback on XDC)
- **Real Blockchain** — All reads from XDC Apothem testnet
- **Working Transactions** — Subscribe, renew, pause, cancel
- **Auto-Renewal** — Keeper cron executes due renewals
- **Token Faucet** — Test tokens minted for demo users

## 🛠 Tech Stack

| Component | Technology |
|-----------|-----------|
| Frontend | Next.js 16 + TypeScript + Tailwind CSS |
| Wallet | Web3Auth (MPC social login) |
| Smart Accounts | Etherspot Modular SDK (ERC-7579) |
| Paymaster | Arka (gas sponsorship + ERC20 fees) |
| Blockchain | XDC Apothem Testnet (EVM-compatible) |
| Contract | SubscriptionManager + 6 ERC20 service tokens |

## 📁 Project Structure

```
src/
  app/              # Next.js pages
    page.tsx        # Landing page
    dashboard/      # Wallet overview + balances
    plans/          # Subscription plans (on-chain)
    subscribe/      # Subscribe flow with AA steps
    history/        # Transaction history
    lifecycle/      # Manage subscriptions
    faucet/         # Test token faucet
    admin/          # Owner-only actions
    evidence/       # Audit + telemetry
    api/            # Backend API routes
  components/       # Reusable components
  lib/
    web3auth.ts     # Web3Auth initialization
    blockchain.ts   # Viem blockchain reads
    etherspot.ts    # Smart account SDK wrapper
    direct-tx.ts    # EOA fallback transactions
    subscription.ts # AA + fallback logic
    renewals.ts     # Auto-renewal dry-run + execution
    services.ts     # 6 service definitions (Netflix, Spotify, etc.)
```

## ⚡ Quick Start (Local)

```bash
# Install dependencies
npm install

# Copy env template
cp .env.example .env.local
# Edit .env.local with your keys

# Run dev server
npm run dev

# Build for production
npm run build
```

## 🔐 Environment Variables

See `.env.example` for full template. Key vars:

```env
# Public (safe to expose)
NEXT_PUBLIC_WEB3AUTH_CLIENT_ID=...
NEXT_PUBLIC_ARKA_API_KEY=etherspot_xxx
NEXT_PUBLIC_BUNDLER_URL=https://testnet-rpc.etherspot.io/v1/51?api-key=xxx
NEXT_PUBLIC_APOTHEM_RPC_URL=https://erpc.apothem.network
NEXT_PUBLIC_CHAIN_ID=51
NEXT_PUBLIC_EXPLORER_URL=https://explorer.apothem.network/

# Contracts
NEXT_PUBLIC_SUBSCRIPTION_MANAGER_ADDRESS=0xe8271C9Bc2255A41cd2AB53FbfB69CE4B5f3032E
NEXT_PUBLIC_NETFLIX_TOKEN_ADDRESS=0x896F79883Bf0620Afcd3D8942f1Db8d3F447AE84
NEXT_PUBLIC_SPOTIFY_TOKEN_ADDRESS=0x9F00925759A9F0FEb13373336B761A7267AE66a9
NEXT_PUBLIC_YOUTUBE_TOKEN_ADDRESS=0x591CCebbd943a2F9a11F64eBf627d86600a0f38e
NEXT_PUBLIC_JIOHOTSTAR_TOKEN_ADDRESS=0x87CB2de7edc1B9D725a5a6DeDdcbEF7e36fe3084
NEXT_PUBLIC_CLAUDE_TOKEN_ADDRESS=0xA228078133e812677533166A44187c1Ae696687A
NEXT_PUBLIC_COPILOT_TOKEN_ADDRESS=0x4c4456bF7A0e572D2C697626025DcB6d3D3Df7D1

# Server-side secrets (NEVER expose)
FAUCET_PRIVATE_KEY=0x...       # Deployer wallet
KEEPER_PRIVATE_KEY=0x...       # Auto-renewal signer
```

## 🎯 Demo Flow

1. **Landing page** → Click "Get Started"
2. **Connect Wallet** → Google login → MPC wallet created
3. **Faucet** → Get 100 free test tokens for each service
4. **Plans** → Choose Netflix/Spotify/YouTube/etc.
5. **Subscribe** → One-click with gasless mode
6. **Dashboard** → See active subscription + balances
7. **History** → Transaction logged with tx hash
8. **Lifecycle** → Renew, pause, or cancel

## 📄 License

MIT
