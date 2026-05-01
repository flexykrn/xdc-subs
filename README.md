# XDC Subs: Decentralized Subscription Platform

A blockchain-powered subscription management platform that enables users to pay for digital services using ERC-20 tokens without requiring native network tokens for gas fees.

**Live Network:** XDC Apothem Testnet (Chain ID: 51)  
**Version:** 1.0  
**Latest Update:** May 2026

---

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Configure environment variables
cp app/.env.example app/.env.local

# Start development server
npm run dev

# Visit http://localhost:3000
```

---

## 📋 Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [How It Works](#how-it-works)
- [Technology Stack](#technology-stack)
- [Project Structure](#project-structure)
- [Installation](#installation)
- [Configuration](#configuration)
- [Development](#development)
- [Smart Contracts](#smart-contracts)
- [API Endpoints](#api-endpoints)
- [Deployment](#deployment)
- [Troubleshooting](#-troubleshooting)

---

## 🎯 Overview

**XDC Subs** is a decentralized subscription platform built on ERC-4337 Account Abstraction that solves critical UX problems for blockchain-based subscriptions:

### The Problem
Traditional blockchain subscriptions require users to:
- Hold native blockchain tokens (XDC/tXDC) just for gas fees
- Sign multiple transactions separately (`approve` + `subscribe`)
- Manage complex wallet recovery if they lose their key

### The Solution
XDC Subs provides:
- **Gasless subscriptions**: Pay with service tokens, not gas tokens
- **Batched transactions**: One signature, multiple actions atomically
- **Social login**: Web3Auth enables Gmail/Discord login
- **Automatic smart account creation**: No manual deployment needed
- **Two payment modes**: Sponsored (free gas) or ERC-20 gas

---

## ✨ Key Features

| Feature | Benefit |
|---------|---------|
| **ERC-4337 Smart Accounts** | Programmable, upgradeable accounts for subscriptions |
| **Web3Auth Integration** | Social login (Google, Discord, etc.) → blockchain wallet |
| **Batch Transactions** | approve() + subscribe() in single atomic tx |
| **Gasless Mode** | Deployer sponsorship for zero-cost onboarding |
| **ERC-20 Gas Payment** | Pay gas using subscription tokens (Netflix tokens pay for Netflix gas) |
| **Counterfactual Deployment** | Smart accounts exist before first transaction |
| **Multi-Token Support** | Netflix, Spotify, YouTube, JioHotstar, Claude, Copilot |
| **Pre-Flight Validation** | Check balances before submitting on-chain |

---

## 🔗 How It Works

### User Journey

```
1. User logs in via Web3Auth (social login)
2. System derives Smart Account address counterfactually
3. User selects service + payment mode
4. System constructs UserOp: approve + subscribe
5. User signs UserOp hash once
6. Client posts UserOp to bundler
7. Bundler calls EntryPoint.handleOps()
8. EntryPoint validates and executes on-chain
9. Smart Account created (if first time)
10. Tokens transferred to SubscriptionManager
11. Subscription recorded, event emitted
12. Success confirmation to user
```

### Architecture Layers

```
┌─────────────────────────────────────────┐
│         User Interface (React)          │
│  Plans • Subscribe • Dashboard • Faucet │
└──────────────────┬──────────────────────┘
                   │
┌──────────────────▼──────────────────────┐
│      ERC-4337 Client Logic              │
│  Smart Account derivation, UserOp build │
│        Web3Auth integration             │
└──────────────────┬──────────────────────┘
                   │ POST /api/bundler/submit
┌──────────────────▼──────────────────────┐
│      Next.js API Layer (Server)         │
│  • Bundler: submits UserOps            │
│  • Paymaster Signer: creates signatures│
│  • Faucet: mints test tokens           │
└──────────────────┬──────────────────────┘
                   │ writeContract()
┌──────────────────▼──────────────────────┐
│      Blockchain (XDC Apothem)           │
│  • EntryPoint: validates & executes    │
│  • Smart Accounts: user accounts        │
│  • SubscriptionManager: core logic      │
│  • ERC-20 Tokens: service tokens        │
└─────────────────────────────────────────┘
```

---

## 💻 Technology Stack

### Frontend
- **Framework**: Next.js 16 with React 19
- **Styling**: Tailwind CSS
- **Authentication**: Web3Auth (social login)
- **Wallet**: Ethers.js v6
- **Charts**: Recharts

### Backend
- **Runtime**: Node.js with Next.js API Routes
- **ERC-4337**: SimpleAccount + EntryPoint v0.7
- **Blockchain**: XDC Apothem Testnet (EVM-compatible)
- **Gas Strategy**: VerifyingPaymaster (sponsor) + TokenPaymaster (ERC-20)

### Smart Contracts
- **Solidity**: ^0.8.23
- **Framework**: Hardhat
- **Standards**: ERC-4337, ERC-20, OpenZeppelin

### Infrastructure
- **RPC**: https://erpc.apothem.network
- **Explorer**: https://testnet.xdcscan.com
- **Network**: XDC Apothem (Chain ID 51)

---

## 📁 Project Structure

```
subscription-manager/
├── app/                           # Next.js frontend & API
│   ├── src/
│   │   ├── app/                   # Pages & API routes
│   │   │   ├── page.tsx           # Landing page
│   │   │   ├── plans/page.tsx     # Browse plans
│   │   │   ├── subscribe/page.tsx # Subscribe flow
│   │   │   ├── dashboard/page.tsx # User dashboard
│   │   │   ├── faucet/page.tsx    # Mint tokens
│   │   │   ├── api/
│   │   │   │   ├── bundler/submit # Post UserOps to EntryPoint
│   │   │   │   ├── paymaster/sign # Sign sponsor UserOps
│   │   │   │   └── faucet/mint    # Mint test tokens
│   │   ├── components/            # Reusable React components
│   │   ├── config/                # App config (addresses, tokens)
│   │   └── lib/                   # Core utilities
│   │       ├── aa-core.ts         # Smart Account derivation, UserOp building
│   │       ├── aa-subscription.ts # Batched subscribe flow
│   │       ├── web3auth.ts        # Web3Auth setup
│   │       └── preflight.ts       # Balance validation
│   ├── public/                    # Static assets
│   ├── package.json
│   ├── tsconfig.json
│   ├── next.config.ts
│   └── eslint.config.mjs
│
├── contracts/                     # Smart contracts
│   ├── contracts/
│   │   ├── SubscriptionManager.sol
│   │   ├── ServiceToken.sol       # ERC-20 (Netflix, Spotify, etc.)
│   │   ├── VerifyingSponsorPaymaster.sol
│   │   ├── TokenPaymaster.sol
│   │   └── SimpleAccount.sol      # (From reference implementations)
│   ├── scripts/
│   │   ├── deploy.ts              # Deploy all contracts
│   │   ├── add-plans.ts           # Add subscription plans
│   │   └── fund-paymasters.ts     # Fund EntryPoint deposits
│   ├── test/
│   ├── hardhat.config.js
│   ├── package.json
│   └── deployment.json            # Saved deployment addresses
│
├── assests/                       # Logo and assets
├── SKILL.md                       # VS Code skill definition
└── README.md                      # This file
```

---

## 🔧 Installation

### Prerequisites
- Node.js 18+ and npm 9+
- A wallet with tXDC (testnet XDC)
- Web3Auth Client ID (from https://dashboard.web3auth.io)

### Step 1: Clone & Install

```bash
git clone https://github.com/your-repo/xdc-subs.git
cd xdc-subs/subscription-manager

npm install
cd app && npm install
cd ../contracts && npm install
```

### Step 2: Get Web3Auth Client ID

1. Visit https://dashboard.web3auth.io
2. Create a new application
3. Copy your **Client ID**

### Step 3: Get Private Keys

You'll need private keys for:
- **Bundler**: Submits UserOps (needs small tXDC balance, ~0.5 tXDC)
- **Paymaster**: Signs sponsor UserOps (needs to own `PAYMASTER_PRIVATE_KEY` in env)
- **Deployer**: Already deployed all contracts (archive for reference)
- **Faucet**: Mints test tokens (needs small tXDC balance)

### Step 4: Deploy Contracts (if fresh)

```bash
cd contracts

# Configure Hardhat
cat > hardhat.config.js << 'EOF'
require("@nomicfoundation/hardhat-toolbox");
module.exports = {
  solidity: "0.8.23",
  networks: {
    apothem: {
      url: "https://erpc.apothem.network",
      accounts: [process.env.DEPLOYER_PRIVATE_KEY]
    }
  }
};
EOF

# Deploy
DEPLOYER_PRIVATE_KEY=0x... npx hardhat run scripts/deploy.ts --network apothem

# Save deployment.json with contract addresses
```

### Step 5: Configure Environment

```bash
cd ../app

cat > .env.local << 'EOF'
# === CLIENT-SIDE ===
NEXT_PUBLIC_WEB3AUTH_CLIENT_ID=YOUR_WEB3AUTH_CLIENT_ID
NEXT_PUBLIC_APOTHEM_RPC_URL=https://erpc.apothem.network
NEXT_PUBLIC_CHAIN_ID=51
NEXT_PUBLIC_ENTRYPOINT_ADDRESS=0x0000000071727De22E5E9d8BAf0edAc6f37da032
NEXT_PUBLIC_SIMPLE_ACCOUNT_FACTORY_ADDRESS=0x91E60e0613810449d098b0b5Ec8b51A0FE8c8985
NEXT_PUBLIC_SUBSCRIPTION_MANAGER_ADDRESS=0xe8271C9Bc2255A41cd2AB53FbfB69CE4B5f3032E
NEXT_PUBLIC_PAYMASTER_ADDRESS=0x8361Fae5A25e71C2E1db35cDE13E7150bB7b1a42
NEXT_PUBLIC_TOKEN_PAYMASTER_ADDRESS=0x17D390EdEb894d8c8B5cD5e6fD47Db923CB4A2c4

# Token addresses
NEXT_PUBLIC_NETFLIX_TOKEN_ADDRESS=0x896F79883Bf0620Afcd3D8942f1Db8d3F447AE84
NEXT_PUBLIC_SPOTIFY_TOKEN_ADDRESS=0x9F00925759A9F0FEb13373336B761A7267AE66a9
NEXT_PUBLIC_YOUTUBE_TOKEN_ADDRESS=0x591CCebbd943a2F9a11F64eBf627d86600a0f38e
NEXT_PUBLIC_JIOHOTSTAR_TOKEN_ADDRESS=0x87CB2de7edc1B9D725a5a6DeDdcbEF7e36fe3084
NEXT_PUBLIC_CLAUDE_TOKEN_ADDRESS=0xA228078133e812677533166A44187c1Ae696687A
NEXT_PUBLIC_COPILOT_TOKEN_ADDRESS=0x4c4456bF7A0e572D2C697626025DcB6d3D3Df7D1

# === SERVER-SIDE (NEVER SHARE) ===
BUNDLER_PRIVATE_KEY=0x...your_bundler_private_key...
PAYMASTER_PRIVATE_KEY=0x...your_paymaster_private_key...
FAUCET_PRIVATE_KEY=0x...your_faucet_private_key...
EOF
```

---

## ⚙️ Configuration

### Environment Variables

#### Public (Client-side, safe to expose)
```
NEXT_PUBLIC_WEB3AUTH_CLIENT_ID     # Web3Auth dashboard
NEXT_PUBLIC_APOTHEM_RPC_URL        # RPC endpoint (https://erpc.apothem.network)
NEXT_PUBLIC_CHAIN_ID               # Must be 51 (XDC Apothem)
NEXT_PUBLIC_ENTRYPOINT_ADDRESS     # ERC-4337 EntryPoint singleton
NEXT_PUBLIC_SIMPLE_ACCOUNT_FACTORY # Deploys SmartAccounts
NEXT_PUBLIC_SUBSCRIPTION_MANAGER   # Core subscription contract
NEXT_PUBLIC_PAYMASTER_ADDRESS      # Sponsor paymaster
NEXT_PUBLIC_TOKEN_PAYMASTER_ADDRESS # ERC-20 paymaster
NEXT_PUBLIC_*_TOKEN_ADDRESS        # ERC-20 service tokens
```

#### Private (Server-side only, NEVER expose to frontend)
```
BUNDLER_PRIVATE_KEY     # Submits UserOps to EntryPoint
PAYMASTER_PRIVATE_KEY   # Signs UserOp validations
FAUCET_PRIVATE_KEY      # Mints test tokens
```

### Key Addresses

| Component | Address |
|-----------|---------|
| EntryPoint v0.7 | `0x0000000071727De22E5E9d8BAf0edAc6f37da032` |
| SimpleAccountFactory | `0x91E60e0613810449d098b0b5Ec8b51A0FE8c8985` |
| SubscriptionManager | `0xe8271C9Bc2255A41cd2AB53FbfB69CE4B5f3032E` |
| VerifyingPaymaster | `0x8361Fae5A25e71C2E1db35cDE13E7150bB7b1a42` |
| TokenPaymaster | `0x17D390EdEb894d8c8B5cD5e6fD47Db923CB4A2c4` |

---

## 🏃 Development

### Start Development Server

```bash
cd app
npm run dev
```

Open http://localhost:3000

### Build for Production

```bash
cd app
npm run build
npm start
```

### Scripts

```bash
# Frontend
npm run dev              # Start dev server
npm run build            # Build for production
npm start                # Start production server
npm run lint             # Run ESLint
npm run format           # Format code with Prettier

# Contracts
cd contracts
npm run compile          # Compile smart contracts
npm run deploy           # Deploy to XDC Apothem
npm run test             # Run contract tests
```

### Development Workflow

1. **Connect via Web3Auth**: Click "Login" button on home page
2. **Get test tokens**: Visit /faucet to mint service tokens
3. **Select plan**: Go to /plans and browse subscription options
4. **Subscribe**: Choose Gasless or ERC-20 mode and subscribe
5. **View dashboard**: Check /dashboard for active subscriptions
6. **Track history**: Visit /history to see transaction logs

---

## 📜 Smart Contracts

### Core Contracts

#### SubscriptionManager
```solidity
// Main subscription logic
contract SubscriptionManager {
  // Add a new subscription plan
  function addPlan(uint256 price, uint256 interval, address tokenAddress)
  
  // Subscribe to a plan
  function subscribe(uint256 planId) returns (uint256 subscriptionId)
  
  // Renew an active subscription
  function renew(uint256 subscriptionId)
  
  // Pause/unpause subscription
  function pause(uint256 subscriptionId)
  
  // Cancel subscription
  function cancel(uint256 subscriptionId)
}
```

#### Service Tokens (ERC-20)
```solidity
// Each service has an ERC-20 token
contract ServiceToken is ERC20, Ownable {
  function mint(address to, uint256 amount)
  function burn(uint256 amount)
}
```

#### VerifyingSponsorPaymaster
```solidity
// Sponsor mode: deployer pays gas
contract VerifyingSponsorPaymaster is BasePaymaster {
  // Server signs UserOp, user pays zero gas
}
```

#### TokenPaymaster
```solidity
// ERC-20 mode: user pays gas with tokens
contract TokenPaymaster is BasePaymaster {
  function addSupportedToken(address token, uint256 rate)
  // Gas rate: 1000 tokens per 1 tXDC
}
```

### Deployment Addresses (XDC Apothem)

See [Contract Addresses](#key-addresses) section above.

---

## 🔌 API Endpoints

All endpoints are server-side protected and require HTTPS in production.

### POST `/api/bundler/submit`
Submit a UserOperation to the EntryPoint.

**Request:**
```json
{
  "userOp": {
    "sender": "0x...",
    "nonce": "0",
    "initCode": "0x...",
    "callData": "0x...",
    "accountGasLimits": "0x...",
    "preVerificationGas": "50000",
    "gasFees": "0x...",
    "paymasterAndData": "0x...",
    "signature": "0x..."
  },
  "mode": "sponsor" | "erc20"
}
```

**Response:**
```json
{
  "success": true,
  "txHash": "0x...",
  "userOpHash": "0x..."
}
```

### POST `/api/paymaster/sign`
Get paymaster signature for sponsor mode UserOp.

**Request:**
```json
{
  "userOp": { /* userOp without paymasterAndData */ },
  "validUntil": 1234567890,
  "validAfter": 0
}
```

**Response:**
```json
{
  "paymasterAndData": "0x...signature..."
}
```

### POST `/api/faucet/mint`
Mint test tokens to user's Smart Account.

**Request:**
```json
{
  "to": "0x...",
  "tokenAddress": "0x...",
  "amount": "100000000000000000000"
}
```

**Response:**
```json
{
  "success": true,
  "txHash": "0x..."
}
```

---

## 🐛 Troubleshooting

### UserOp Validation Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `AA25: Invalid Account Nonce` | Nonce collision | Fetch fresh nonce before each UserOp |
| `AA31: Paymaster Deposit Too Low` | VerifyingPaymaster underfunded | Deposit 10+ tXDC to EntryPoint: `ep.depositTo(paymaster, {value: e18(10)})` |
| `AA21: Didn't Pay Prefund` | TokenPaymaster empty or SA has no tokens | Fund TokenPaymaster + use faucet for SA |
| `AA33: Failed to Pay Paymaster` | Token not in `supportedTokens` or rate = 0 | Add token via `paymaster.addSupportedToken(addr, 1000)` |
| `AA80: Reverted in postOp` | callData execution reverted | Check SubscriptionManager logic on XDCScan |
| `AA94: Out of Gas` | `callGasLimit` too low | Increase by 50K and retry |
| `AA32: Paymaster Signature Invalid` | Wrong key or expired timestamp | Verify `PAYMASTER_PRIVATE_KEY`, check `validUntil` |

### Common Issues

**"Web3Auth login not working"**
- Verify `NEXT_PUBLIC_WEB3AUTH_CLIENT_ID` is set and correct
- Check Web3Auth dashboard: Applications → whitelisted domains
- Ensure redirect URL matches your app domain
- Clear browser cache and localStorage
- Try incognito window to eliminate browser extensions

**"Smart Account address not derived"**
- Verify `NEXT_PUBLIC_SIMPLE_ACCOUNT_FACTORY_ADDRESS` is correct
- Test RPC connectivity: `curl -X POST https://erpc.apothem.network -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'`
- Confirm factory contract exists at address: visit on XDCScan
- Check owner address is derived correctly from EOA

**"Bundler fails to submit UserOp"**
- Ensure `BUNDLER_PRIVATE_KEY` has tXDC balance (minimum 0.5 tXDC)
- Get bundler address: `ethers.Wallet.fromPrivateKey(key).address`
- Verify EntryPoint address matches: `0x0000000071727De22E5E9d8BAf0edAc6f37da032`
- Check UserOp serialization using correct Ethers v6 `PackedUserOperation` types
- Review exact error message from contract on XDCScan

**"Token balance shows zero after mint"**
- Faucet transaction may still be pending (3-5 second confirmation)
- Check XDCScan for faucet tx confirmation
- Verify token contract address hasn't changed in env vars
- Confirm Smart Account address derivation is consistent
- Try refreshing page and checking balance again

**"Paymaster signature invalid"**
- Ensure `PAYMASTER_PRIVATE_KEY` matches paymaster owner from deployment
- Verify signature timestamp: `validUntil > block.timestamp` on XDCScan
- Confirm UserOp hash calculation includes chainId (51) and entrypoint address
- Check signature encoding format (packed vs unpacked)

**"Cannot subscribe - insufficient balance"**
- Calculate total needed: subscription_price + estimated_gas_in_tokens
- Use `/faucet` page to mint additional tokens
- Verify subscription price matches plan configuration
- Gas estimate might be conservative; add 20% buffer

**"initCode too large"**
- Factory code should only be factory address + create call
- Minimize additional initialization parameters
- Check factory ABI encoding

**"Execution reverted in postOp"**
- Visit XDCScan transaction details for exact revert reason
- Check SubscriptionManager events for clues
- Verify approve() call happened before subscribe() in batch
- Ensure allowance was set to price (not zero)
- Confirm plan ID exists and is active

---

## 📚 Additional Resources

### Learn More
- [ERC-4337 Specification](https://eips.ethereum.org/EIPS/eip-4337)
- [Web3Auth Documentation](https://web3auth.io/docs)
- [XDC Network](https://xinfin.org)
- [Hardhat Documentation](https://hardhat.org)
- [Next.js Documentation](https://nextjs.org)

### External Links
- **XDC Explorer**: https://testnet.xdcscan.com
- **Faucet**: https://xdc-apothem-faucet.blocksscan.io
- **Web3Auth Dashboard**: https://dashboard.web3auth.io
- **GitHub**: https://github.com/your-repo/xdc-subs

---

## 📄 License

This project is licensed under the MIT License. See [LICENSE](LICENSE) file for details.

---

## 🤝 Contributing

Contributions are welcome! Please follow these guidelines:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---



## ✅ Status

| Component | Status |
|-----------|--------|
| Smart Contracts | ✅ Deployed |
| Frontend | ✅ Live |
| Bundler | ✅ Running |
| Paymasters | ✅ Funded |
| Test Tokens | ✅ Available |
| Production | ✅ Ready |

---

**Made with ❤️ for the XDC Network**
