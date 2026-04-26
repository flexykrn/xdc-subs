# Subscription Manager (XDC Apothem)

Project bootstrapped with:
- Hardhat (JavaScript) in `contracts`
- Next.js App Router (TypeScript) in `app`

AA stack installed in `app`:
- `@etherspot/modular-sdk`
- `@web3auth/modal`
- `@web3auth/base`
- `@web3auth/ethereum-provider`
- `ethers`

Reference skill/context file:
- `SKILL.md`

## 1) Contracts setup

```bash
cd contracts
cp .env.example .env
# fill APOTHEM_RPC_URL and DEPLOYER_PRIVATE_KEY
npm install
npm run compile
npm run deploy:apothem
```

Deployment addresses are saved to `contracts/deployment.json`.

## 2) Frontend setup

```bash
cd app
cp .env.local.example .env.local
# fill Web3Auth, Arka, bundler and contract addresses
npm install
npm run dev
```

Arka paymaster endpoint pattern used by this project:

```text
https://arka.etherspot.io?apiKey=<API_KEY>&chainId=51
```

Paymaster modes to implement:
- sponsor
- erc20 (requires tokenAddress)
- multi-token (requires tokenAddress)

If you need to fund a test wallet with demo tokens after deployment, use:

```bash
cd contracts
npm run mint:demo -- --recipient <wallet-address> --token A --amount 1000
```

Use `--token B` for TokenB.

App routes:
- `/`
- `/plans`
- `/subscribe`
- `/dashboard`
- `/history`

## 3) Suggested next implementation steps

1. Add Web3Auth login in `app/src/lib/web3auth.ts` and dashboard.
2. Add Etherspot SDK initialization and smart account fetch in `app/src/lib/etherspot.ts`.
3. Implement unified sender `sendSubscriptionAction(mode, tokenAddress?)`.
4. Integrate sponsor, ERC20, and multi-token paymaster contexts.
5. Add telemetry logging and history table integration.
