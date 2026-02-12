# Agent Reputation Oracle

**On-chain reputation system for AI agents on Solana**

Built for the [Colosseum Agent Hackathon](https://arena.colosseum.org/) (Feb 2-12, 2026)

## What is it?

Agent Reputation Oracle is a decentralized trust layer for AI agents. Agents stake SOL to vouch for each other, creating verifiable reputation chains (inspired by Islamic hadith authentication/"isnad" chains). When disputes arise, bad vouches get slashed, ensuring skin-in-the-game accountability.

## Why this matters

As AI agents proliferate in crypto (trading bots, wallet assistants, code generators), trust becomes critical. **The Moltbook community identified skill.md supply chain attacks as a critical security threat** ([see this 109k-comment discussion](https://www.moltbook.com/post/cbd6474f-8478-4894-95f1-7b104a73bcd5)). Our system provides:

- **Composable trust**: Query on-chain before using an agent
- **Economic security**: Vouchers lose stake if they endorse bad actors  
- **Transparent provenance**: See who vouches for whom, and their track record (implements "isnad chains" from Islamic hadith authentication)
- **Dispute resolution**: Community-driven slashing mechanism

### The Problem (Validated by Community)

From eudaemon_0's [viral Moltbook security post](https://www.moltbook.com/post/cbd6474f-8478-4894-95f1-7b104a73bcd5) (4.5k upvotes, 109k comments):

> "Rufio scanned all 286 ClawdHub skills with YARA rules and found a credential stealer disguised as a weather skill. **The agent internet needs a security layer.** Who is building it with me?"

> "What we need: **Isnad chains** — Every skill carries a provenance chain: who wrote it, who audited it, who vouches for it. Like Islamic hadith authentication — a saying is only as trustworthy as its chain of transmission."

Our system implements this vision with on-chain reputation staking, slashing for bad vouches, and transparent vouch chains.

## Tech Stack

- **Smart Contracts**: Solana/Anchor (Rust)
- **Frontend**: Next.js + Tailwind + Solana Wallet Adapter
- **Deployment**: Solana Devnet (live at program ID `8VXXu4RMq6V3M7hFufbkjfRJ5vHhXFpEZWfx2mXPumSQ`)

## Features

✅ Agent registration with metadata  
✅ Vouch creation with staked SOL  
✅ Dispute opening/resolution with slashing  
✅ Vouch revocation (withdraw stake)  
✅ Query reputation scores  
✅ Web UI with wallet integration  

## Getting Started

### Prerequisites

- Rust 1.75+
- Solana CLI 1.18+
- Anchor 0.30+
- Node.js 18+

### Install & Test

```bash
# Install dependencies
yarn install

# Run tests
anchor test

# Deploy (update Anchor.toml with your program ID)
anchor deploy --provider.cluster devnet
```

### Run the Web UI

```bash
cd web
npm install
npm run dev
```

Visit http://localhost:3000 and connect your Solana wallet.

## Smart Contract Architecture

**Key accounts:**
- `Config`: Global configuration (min vouch amount, dispute delay)
- `Agent`: Per-agent profile (DID, reputation score, vouch counts)
- `Vouch`: Stake record linking voucher → vouchee
- `Dispute`: Challenge record with evidence and resolution status

**Core instructions:**
- `initialize_config` - Admin setup
- `register_agent` - Create agent profile
- `vouch` - Stake SOL to vouch for another agent
- `revoke_vouch` - Withdraw vouch (if no disputes)
- `open_dispute` - Challenge a vouch with evidence
- `resolve_dispute` - Admin/arbitrator slashing decision

## Roadmap

- [ ] Multi-party dispute arbitration (DAO governance)
- [ ] Integration with agent marketplaces (e.g., Eliza plugins)
- [ ] Cross-chain reputation bridging (Ethereum, Base)
- [ ] On-chain evidence storage (IPFS + Solana pointers)
- [ ] Reputation decay over time

## License

MIT

## Team

Built by [@oddboxmusic](https://twitter.com/oddboxmusic) (Oddbox) with AI assistant Sparky ⚡

## Links

- **Hackathon**: [Colosseum Agent Arena](https://arena.colosseum.org/)
- **Twitter**: [@dirtybits](https://twitter.com/dirtybits)
- **Moltbook**: [OddSparky](https://moltbook.com/u/OddSparky)
