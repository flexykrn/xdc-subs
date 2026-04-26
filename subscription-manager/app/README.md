# AA Subscription Manager

A **decentralized subscription management platform** built with Account Abstraction (ERC-7579) on XDC Network.

## 🚀 Features

- **Social Login** — Google/Twitter/Discord via Web3Auth MPC
- **Gasless Transactions** — Arka Paymaster sponsors gas fees
- **Smart Accounts** — Etherspot ERC-7579 modular accounts
- **Real Blockchain** — All reads from XDC Apothem testnet
- **Working Transactions** — Subscribe, renew, pause, cancel

## 🛠 Tech Stack

| Component | Technology |
|-----------|-----------|
| Frontend | Next.js 16 + TypeScript + Tailwind CSS |
| Wallet | Web3Auth (MPC social login) |
| Smart Accounts | Etherspot Modular SDK (ERC-7579) |
| Paymaster | Arka (gas sponsorship + ERC20 fees) |
| Blockchain | XDC Apothem Testnet (EVM-compatible) |
| Contract | SubscriptionManager Solidity |

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
    deployment.ts   # Contract deployment records
  config/chains.ts  # XDC Apothem chain config
```

## ⚡ Quick Start

```bash
# Install dependencies
npm install

# Run dev server
npm run dev

# Build for production
npm run build
```

## 🔐 Environment Variables

Create `.env.local`:

```env
# Web3Auth (get from dashboard.web3auth.io)
NEXT_PUBLIC_WEB3AUTH_CLIENT_ID=your_client_id

# Etherspot / Arka (get from etherspot.io)
NEXT_PUBLIC_ARKA_API_KEY=etherspot_xxx
NEXT_PUBLIC_BUNDLER_URL=https://testnet-rpc.etherspot.io/v1/51?api-key=xxx

# XDC Network
NEXT_PUBLIC_APOTHEM_RPC_URL=https://erpc.apothem.network
NEXT_PUBLIC_CHAIN_ID=51
NEXT_PUBLIC_EXPLORER_URL=https://explorer.apothem.network/

# Smart Contract (from deployment.json)
NEXT_PUBLIC_SUBSCRIPTION_MANAGER_ADDRESS=0x...
NEXT_PUBLIC_TOKEN_A_ADDRESS=0x...
NEXT_PUBLIC_TOKEN_B_ADDRESS=0x...
```

## 🎯 Demo Flow

1. **Landing page** → "Web3 Subscriptions, Zero Friction"
2. **Connect Wallet** → Google login → MPC wallet created
3. **Dashboard** → Real XDC + token balances from blockchain
4. **Plans** → Choose plan (active status verified on-chain)
5. **Subscribe** → Watch 6-step AA flow → Transaction submits
6. **Explorer** → View real tx on XDC Apothem
7. **Lifecycle** → See active subscription
8. **History** → Transaction logged

## 📝 Known Limitations

- **Etherspot factory not deployed on XDC Apothem** → Smart account shows "compute pending". Transactions use EOA fallback (still real on-chain).
- **History from telemetry** → Not blockchain scan. Production would index events.

## 📄 License

MIT
