# SKILL.md

Ethskills is now installed for this repository as an external skill reference.
Source skill:
- https://github.com/austintgriffith/ethskills/blob/master/SKILL.md

This file defines how to use that skill in this specific XDC Apothem Account Abstraction project.

## 1) Installed skill entry points

Primary entry:
- https://ethskills.com/SKILL.md

Start-here guide:
- https://ethskills.com/ship/SKILL.md

Project-specific skill set:
- https://ethskills.com/wallets/SKILL.md
- https://ethskills.com/gas/SKILL.md
- https://ethskills.com/security/SKILL.md
- https://ethskills.com/tools/SKILL.md
- https://ethskills.com/testing/SKILL.md
- https://ethskills.com/frontend-ux/SKILL.md

## 2) What “installed” means in this repository

Ethskills is a knowledge skill, not a runtime npm dependency.
Installation here means:
- skill source is pinned in this SKILL.md
- required sub-skills are mapped to project tasks
- team members can follow the same guidance without AI tools

## 3) How to use this skill by task

Planning and architecture:
- Fetch ship + concepts + l2s

Wallet and onboarding flow:
- Fetch wallets + frontend-ux

AA gasless flows and cost assumptions:
- Fetch gas + tools + standards

Contract safety and review:
- Fetch security + testing

Final QA before demo/report:
- Fetch qa + frontend-ux + testing

## 4) Project-specific rules (XDC subscription manager)

Use these fixed decisions:
- frontend: Next.js App Router
- contracts: Hardhat (JavaScript)
- AA SDK: Etherspot Modular SDK
- login: Web3Auth
- network: XDC Apothem
- wallet chain id format: 0x33
- sdk/backend chain id format: 51

Arka paymaster URL pattern:
- https://arka.etherspot.io?apiKey=<API_KEY>&chainId=51

Supported paymaster contexts in this project:
- sponsor
- erc20 (requires tokenAddress)
- multi-token (requires tokenAddress)

## 5) XGate usage policy

Reference implementation only:
- https://github.com/satz07/XGate

Allowed reuse:
- integration pattern for Web3Auth + Etherspot + Arka

Not allowed:
- copying the full app as final submission

## 6) Safety and evidence checklist

Mandatory safety checks:
- never commit private keys or API keys
- never log private keys in browser or backend logs
- always validate chain id before tx build

Mandatory evidence for internship report:
- contract addresses
- userOp hash
- tx hash
- explorer links
- mode used (sponsor/erc20/multi-token)

## 7) Manual usage prompt

Use this exact prompt with any assistant/tooling:
- Install the https://github.com/austintgriffith/ethskills/blob/master/SKILL.md skill and apply wallets, gas, security, tools, frontend-ux, and testing guidance to this XDC Apothem AA subscription manager project.
