# Agent Reputation Oracle — Hackathon Plan

## Overview

**Hackathon:** Colosseum Agent Hackathon (Feb 2–12, 2026)
**Team:** OddSparky (Oddbox + Sparky ⚡)
**Prize Pool:** $100k USDC
**Deadline:** February 12, 2026
**Days Remaining:** 1.5 (as of Feb 10, 11pm)

## The Idea

An on-chain reputation system where AI agents stake SOL to vouch for each other. Bad vouches get slashed when disputes arise. This creates a trust layer for agent marketplaces, collaborations, and autonomous transactions.

### Why This Matters

- AI agents increasingly transact on-chain — but there's no trust infrastructure
- Current agent interactions are trust-blind: no history, no accountability
- Staking-based vouching creates skin-in-the-game reputation signals
- Composable primitive that other protocols can build on top of

### Core Mechanics

1. **Agent Registration** — Agents register on-chain with a wallet + metadata URI
2. **Vouching** — Agent A stakes SOL to vouch for Agent B (putting reputation on the line)
3. **Reputation Score** — Derived from total vouches received, stake weight, vouch history
4. **Disputes** — Any agent can challenge a vouch; resolution triggers slashing or vindication
5. **Slashing** — Failed vouches lose staked SOL; slashed funds go to dispute pool / challenger

## Architecture

```
┌─────────────────────────────────────────────────┐
│                   Web UI (Next.js)              │
│  - Agent profiles & reputation scores           │
│  - Vouch/dispute actions via wallet adapter      │
│  - Leaderboard & network graph                  │
└──────────────────────┬──────────────────────────┘
                       │
┌──────────────────────┴──────────────────────────┐
│               Query API (REST/JSON)              │
│  - GET /agent/:pubkey — reputation + vouches     │
│  - GET /leaderboard — top agents by score        │
│  - GET /vouches/:pubkey — vouch history          │
│  - GET /disputes/:pubkey — dispute history       │
└──────────────────────┬──────────────────────────┘
                       │
┌──────────────────────┴──────────────────────────┐
│          Solana Program (Anchor/Rust)             │
│                                                  │
│  Instructions:                                   │
│  - register_agent(metadata_uri)                  │
│  - vouch(target_agent, stake_amount)             │
│  - revoke_vouch(vouch_id)                        │
│  - open_dispute(vouch_id, evidence_uri)          │
│  - resolve_dispute(dispute_id, ruling)           │
│                                                  │
│  Accounts:                                       │
│  - AgentProfile (PDA per agent wallet)           │
│  - Vouch (PDA per vouch relationship)            │
│  - Dispute (PDA per dispute)                     │
│  - ReputationConfig (program authority settings) │
└──────────────────────────────────────────────────┘
```

## Account Structures

### AgentProfile
```rust
pub struct AgentProfile {
    pub authority: Pubkey,        // Agent's wallet
    pub metadata_uri: String,     // Off-chain metadata (name, description, capabilities)
    pub reputation_score: u64,    // Computed score
    pub total_vouches_received: u32,
    pub total_vouches_given: u32,
    pub total_staked_for: u64,    // Total SOL staked by others vouching for this agent
    pub disputes_won: u32,
    pub disputes_lost: u32,
    pub registered_at: i64,       // Timestamp
    pub bump: u8,
}
```

### Vouch
```rust
pub struct Vouch {
    pub voucher: Pubkey,          // Who is vouching
    pub vouchee: Pubkey,          // Who is being vouched for
    pub stake_amount: u64,        // SOL staked (lamports)
    pub created_at: i64,
    pub status: VouchStatus,      // Active, Revoked, Slashed
    pub bump: u8,
}

pub enum VouchStatus {
    Active,
    Revoked,
    Disputed,
    Slashed,
    Vindicated,
}
```

### Dispute
```rust
pub struct Dispute {
    pub vouch: Pubkey,            // The vouch being disputed
    pub challenger: Pubkey,       // Who opened the dispute
    pub evidence_uri: String,     // Off-chain evidence
    pub status: DisputeStatus,    // Open, Resolved
    pub ruling: Option<DisputeRuling>,
    pub created_at: i64,
    pub resolved_at: Option<i64>,
    pub bump: u8,
}

pub enum DisputeStatus {
    Open,
    Resolved,
}

pub enum DisputeRuling {
    SlashVoucher,    // Voucher was wrong — stake slashed
    Vindicate,       // Vouch was valid — challenger penalized
}
```

### ReputationConfig
```rust
pub struct ReputationConfig {
    pub authority: Pubkey,            // Program admin
    pub min_stake: u64,               // Minimum vouch stake (lamports)
    pub dispute_bond: u64,            // Bond required to open dispute
    pub slash_percentage: u8,         // % of stake slashed (e.g. 50)
    pub cooldown_period: i64,         // Seconds before revoked vouch stake returns
    pub bump: u8,
}
```

## Reputation Score Formula

```
score = (total_staked_for * stake_weight)
      + (vouches_received * vouch_weight)
      - (disputes_lost * dispute_penalty)
      + (agent_age_days * longevity_bonus)
```

Weights are configurable via `ReputationConfig`. Initial defaults:
- `stake_weight`: 1 (1 point per lamport staked)
- `vouch_weight`: 100 (100 points per vouch)
- `dispute_penalty`: 500 (500 points lost per dispute loss)
- `longevity_bonus`: 10 (10 points per day registered)

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Smart Contract | Rust + Anchor v0.31.1 |
| Blockchain | Solana (devnet → mainnet) |
| Web UI | Next.js 14 + React + Tailwind CSS |
| Wallet | @solana/wallet-adapter |
| API | Next.js API routes or standalone Express |
| Indexing | Solana account subscriptions + optional Helius webhooks |
| Testing | Anchor test framework (Mocha + Chai) |
| Deployment | Vercel (UI) + Solana devnet (program) |

## Development Schedule

### Day 1 — Feb 8 (Saturday) ✅ COMPLETE
**Goal: Smart contract foundation**
- [x] Install Solana CLI
- [x] Initialize Anchor project (`agent-reputation-oracle`)
- [x] Implement `register_agent` instruction
- [x] Implement `vouch` instruction (with SOL staking)
- [x] Implement `revoke_vouch` instruction
- [x] Write basic tests for registration + vouching
- [x] Set up devnet deployment
- [x] BONUS: Implemented dispute system (open + resolve)
- [x] BONUS: Full test suite (8 tests, all passing)
- [x] BONUS: Reputation computation with configurable weights

**Program ID:** `EDtweyEKbbesS4YbumnbdQeNr3aqdvUF9Df4g9wuuVoj`  
**Status:** Deployed to devnet ✅

### Day 2 — Feb 9 (Sunday) ✅ COMPLETE
**Goal: Disputes + scoring**
- [x] Implement `open_dispute` instruction (done in Day 1)
- [x] Implement `resolve_dispute` instruction (done in Day 1)
- [x] Implement reputation score computation (done in Day 1)
- [x] Implement `ReputationConfig` initialization (done in Day 1)
- [x] Comprehensive test suite for disputes + edge cases (8 tests passing)
- [x] Deploy updated program to devnet

**Status:** All dispute + scoring work completed ahead of schedule on Day 1 ✅

### Day 3 — Feb 10 (Monday) 🚧 IN PROGRESS
**Goal: Web UI + GitHub**
- [x] Initialize Next.js project with wallet adapter
- [x] Build agent profile page (registration + view)
- [x] Build vouch interface (stake SOL, view vouches)
- [x] Build dispute interface
- [x] Build agent explorer (search any agent by address)
- [x] Tabbed UI (Profile | Vouch | Explore | Disputes)
- [x] Connect UI to devnet program
- [x] GitHub repo created (`dirtybits/agent-reputation-oracle`)
- [x] Comprehensive README written
- [x] Submission description drafted (`SUBMISSION.md`)
- [ ] REST API endpoints for reputation queries (optional - Next.js API routes)
- [ ] Deploy UI to Vercel/production

**Status:** Core UI complete, ready for deployment ✅

### Day 4 — Feb 11 (Tuesday) — POLISH DAY
**Goal: Deploy, test, record demo**
- [ ] Deploy UI to Vercel (public URL)
- [ ] End-to-end testing on devnet with real wallet
- [ ] Record demo video (2-3 min walkthrough)
- [ ] Test video upload/submission flow
- [ ] Polish UI based on testing
- [ ] Update SUBMISSION.md with live demo URL
- [ ] Optional: Basic API endpoints if time permits

### Day 5 — Feb 12 (Wednesday) — DEADLINE DAY
**Goal: Submit before deadline**
- [ ] Final smoke test (contract + UI)
- [ ] Submit to Colosseum platform
- [ ] Verify submission received
- [ ] Tweet/share project (optional)
- [ ] Backup: Fix any last-minute issues

## MVP vs Nice-to-Have

### MVP (Must Ship)
- Agent registration
- Vouch with SOL staking
- Vouch revocation
- Basic dispute + slashing
- Reputation score query
- Simple web UI
- REST API

### Nice-to-Have (If Time Permits)
- Network graph visualization
- AgentWallet SDK integration
- Reputation decay over time
- Multi-sig dispute resolution (jury of agents)
- Historical reputation tracking
- Webhook notifications for reputation changes
- Badge/tier system (Trusted, Verified, etc.)

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Scope creep | Stick to MVP checklist; defer nice-to-haves |
| Anchor bugs | Test early, deploy to devnet daily |
| Time pressure | Focus on contract first (hardest part), UI can be minimal |
| Dispute complexity | Start with simple admin-resolved disputes, upgrade later |
| Solana CLI issues | Use Anchor's built-in tooling as much as possible |

## Key Decisions

- **Dispute resolution:** Start with program authority (admin) as resolver. Multi-sig jury is a v2 feature.
- **Score formula:** Keep simple and transparent. Can be upgraded via config.
- **Metadata storage:** Off-chain (URI pointing to JSON). Keeps on-chain costs low.
- **Minimum stake:** Configurable, default 0.01 SOL (prevents spam while keeping barrier low).
- **GitHub Access (Security):** Using full `repo` scope during hackathon for velocity. Will lock down to fine-grained token post-submission (see `GITHUB_TOKEN_SETUP.md`).

## Project Structure

```
agent-reputation-oracle/
├── programs/
│   └── reputation-oracle/
│       └── src/
│           ├── lib.rs              # Program entry
│           ├── instructions/
│           │   ├── mod.rs
│           │   ├── register.rs     # register_agent
│           │   ├── vouch.rs        # vouch + revoke_vouch
│           │   └── dispute.rs      # open_dispute + resolve_dispute
│           ├── state/
│           │   ├── mod.rs
│           │   ├── agent.rs        # AgentProfile
│           │   ├── vouch.rs        # Vouch
│           │   ├── dispute.rs      # Dispute
│           │   └── config.rs       # ReputationConfig
│           └── errors.rs           # Custom error codes
├── tests/
│   └── reputation-oracle.ts
├── app/                            # Next.js web UI
│   ├── src/
│   │   ├── app/
│   │   ├── components/
│   │   └── lib/
│   ├── package.json
│   └── next.config.js
├── Anchor.toml
├── Cargo.toml
└── README.md
```

## Submission Checklist

- [x] Working smart contract on devnet (`EDtweyEKbbesS4YbumnbdQeNr3aqdvUF9Df4g9wuuVoj`)
- [x] GitHub repo with code (`https://github.com/dirtybits/agent-reputation-oracle`)
- [x] README with setup instructions
- [x] Submission description drafted
- [ ] Live web UI (Vercel or similar) — **NEXT PRIORITY**
- [ ] Demo video (2-3 min) — **Feb 11**
- [ ] Public API endpoint (optional, nice-to-have)
- [ ] Submission on Colosseum platform — **Feb 12 DEADLINE**

## Current Status (Feb 10, 11pm PST)

✅ **Smart Contract:** COMPLETE - All core features implemented, tested, deployed  
✅ **Web UI:** COMPLETE - Full-featured UI with tabs, wallet integration, all actions  
✅ **GitHub:** COMPLETE - Public repo with comprehensive docs  
✅ **Submission Draft:** COMPLETE - Ready to copy-paste into Colosseum  

🚧 **TODO (Next 36 hours):**
1. Deploy UI to Vercel (30 min)
2. End-to-end test with real wallet (1 hour)
3. Record demo video (1-2 hours)
4. Submit to Colosseum (30 min)

**Timeline looks good!** Ahead of schedule on core features, on track for deadline.

---

*Last updated: Feb 10, 2026 11pm PST*
*Status: Day 3 complete, moving into deployment phase*
