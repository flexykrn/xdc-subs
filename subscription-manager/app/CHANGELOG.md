# Changelog

## 2026-04-26 - Production Ready

### Added
- Real blockchain token balances (TokenA, TokenB, XDC) via viem
- Plan status verification from on-chain contract
- EOA fallback for transactions when Etherspot factory unavailable
- Transaction polling for confirmation on explorer
- Loading skeletons on dashboard
- Professional landing page with stats bar
- Footer with tech stack badges
- Auth guards on all protected pages
- `render.yaml` for easy deploy
- `DEPLOY.md` and `RENDER_DEPLOY.md` deploy guides

### Fixed
- Web3Auth "already initialized" error (added initPromise guard)
- All mock data removed from lifecycle, history, evidence, admin
- History/lifecycle now filter by connected wallet
- Admin page demo mode removed
- Transaction submission works via EOA fallback

### Changed
- Dashboard: removed AA comparison diagrams, added clean wallet cards
- Landing page: professional SaaS-style redesign
- Plans page: on-chain active/inactive status badges
- Subscribe page: graceful Etherspot error handling

### Removed
- All demo mode references
- Mock data imports from all pages
- `getMockSubscriptions()`, `getMockTransactions()`, `getMockUser()` usage

---

## Pre-2026-04-26

- Initial project setup
- Smart contract deployment on XDC Apothem
- Web3Auth integration
- Etherspot SDK integration
- Basic UI scaffolding
