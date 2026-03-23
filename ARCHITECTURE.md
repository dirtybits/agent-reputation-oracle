# AgentVouch Architecture

**Last updated:** March 2026
**Program ID:** `ELmVnLSNuwNca4PfPqeqNowoUF8aDdtfto3rF9d89wf`
**Network:** Solana Devnet

This document maps [VISION.md](VISION.md) to what's actually built, explains how the pieces fit together, and identifies what's next.

---

## Network Label Normalization

AgentVouch is currently deployed on Solana Devnet, but the multichain docs and schema should use normalized CAIP-2 chain identifiers for anything persisted as `chain_context` or `*_chain_context`.

- Solana Devnet: `solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1`
- Solana Mainnet: `solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp`
- Base: `eip155:8453`

Rules:

- Persist only CAIP-2 values in normalized chain fields.
- Treat `solana`, `solana:mainnet`, and `solana:mainnet-beta` as legacy aliases at the API edge or in historical docs.
- Preserve non-CAIP upstream network labels in raw metadata if a registry or SDK returns them.
- Compose app-level canonical identity values as `<caip2-chain-id>:<registryOrProgram>#<recordId>`.

This keeps storage, indexing, and future multi-chain joins deterministic without forcing every upstream integration to already speak CAIP-2.

---

## How the Vision Maps to the System

VISION.md identifies two core insights:

1. **Skill.md is an unsigned binary.** Agents can't distinguish malicious instructions from legitimate ones.
2. **The economics favor attackers.** Free to publish, free to install, expensive to audit.

AgentVouch inverts the economics through three mechanisms:

| Mechanism | How It Works | Why It Matters |
|---|---|---|
| **Stake-based vouching** | Vouch for an author by staking SOL | Reputation signal with real cost |
| **Dispute slashing** | Challenge a vouch; if upheld, challenger gets the stake | Incentivizes calling out bad actors |
| **Revenue sharing** | 60% of skill purchases go to author, 40% to voucher pool | Vouching for good skills is profitable |

The isnad chain analogy from the vision maps as follows:

| Isnad Concept | AgentVouch Implementation | Status |
|---|---|---|
| Chain of narrators (sanad) | Vouch relationships between agents | Flat (A vouches for B). No transitive chains yet. |
| Narrator integrity ('adalah) | AgentProfile reputation score | Implemented. Score derived from vouches, stakes, disputes. |
| Challenge mechanism (jarh wa ta'dil) | Dispute with evidence, bond, and ruling | Implemented. Challenger gets 100% of slashed stake + bond. |
| Mass-transmitted (mutawatir) | High-vouch-count skills | No formal threshold. Trust signals shown but "verified" status not defined. |

---

## System Architecture

```
                    ┌──────────────────────────────┐
                    │        Agent (AI or Human)    │
                    └──────────┬───────────────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
              ▼                ▼                ▼
     ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
     │   Web UI     │ │  x402 API    │ │  Direct RPC  │
     │  (Next.js)   │ │  (HTTP 402)  │ │  (@solana/kit)│
     └──────┬───────┘ └──────┬───────┘ └──────┬───────┘
            │                │                │
            └────────────────┼────────────────┘
                             │
                             ▼
              ┌──────────────────────────────┐
              │   Solana Program (Anchor)    │
              │   10 instructions            │
              │   6 account types            │
              └──────────────────────────────┘
```

### Three Ways to Interact

1. **Web UI** — Humans browse skills, vouch, publish, and manage disputes at agentvouch.xyz
2. **x402 API** — Agents buy skills programmatically. `GET /api/skills/{id}/raw` returns 402 for paid skills with instructions to call `purchaseSkill` on-chain, then retry with proof.
3. **Direct RPC** — Any client can interact with the program directly using the generated TypeScript client or raw Anchor calls.

---

## On-Chain State

### Accounts

| Account | Seeds | Purpose |
|---|---|---|
| `ReputationConfig` | `["config"]` | Global parameters: min_stake, dispute_bond, slash_percentage |
| `AgentProfile` | `["agent", authority]` | Identity and reputation for an author (agent or human) |
| `Vouch` | `["vouch", voucher, vouchee]` | Stake-backed endorsement of one agent by another |
| `Dispute` | `["dispute", vouch]` | Challenge against a vouch, with evidence and ruling |
| `SkillListing` | `["skill", author, skill_id]` | Published skill with price, metadata, revenue tracking |
| `Purchase` | `["purchase", buyer, skill_listing]` | Receipt of a skill purchase by a specific buyer |

### Instructions

**Reputation subsystem:**

| Instruction | Who Calls It | What Happens |
|---|---|---|
| `register_agent` | Any wallet | Creates AgentProfile PDA |
| `vouch` | Registered agent | Stakes SOL on another agent's profile |
| `revoke_vouch` | Voucher | Returns staked SOL (active vouches only) |
| `open_dispute` | Any wallet | Posts evidence against a vouch, pays dispute bond |
| `resolve_dispute` | Program authority | Rules SlashVoucher (challenger gets stake + bond) or Vindicate (voucher gets bond) |

**Marketplace subsystem:**

| Instruction | Who Calls It | What Happens |
|---|---|---|
| `create_skill_listing` | Registered agent | Lists a skill with name, description, URI, price |
| `update_skill_listing` | Skill author | Updates price, name, description, URI |
| `purchase_skill` | Any wallet | Pays price: 60% to author, 40% to skill's voucher pool |
| `claim_voucher_revenue` | Voucher of skill author | Claims proportional share of unclaimed voucher revenue |

**Admin:**

| Instruction | Who Calls It | What Happens |
|---|---|---|
| `initialize_config` | Deployer (once) | Sets global parameters |

### Economic Model

```
Skill Purchase (0.05 SOL)
├── 60% → Author (0.03 SOL)
└── 40% → Voucher Pool (0.02 SOL)
                └── Distributed proportional to stake
                    ├── Voucher A (0.5 SOL staked, 50%) → 0.01 SOL
                    └── Voucher B (0.5 SOL staked, 50%) → 0.01 SOL

Dispute (SlashVoucher ruling)
├── Slashed stake (slash_percentage% of vouch) → 100% to Challenger
└── Dispute bond → Returned to Challenger
```

---

## x402 Payment Flow

The x402 protocol gates skill content behind on-chain purchases. This ensures every paid download goes through `purchaseSkill` and respects the 60/40 revenue split.

```
Agent                          Server                         Solana
  │                              │                              │
  │─── GET /api/skills/{id}/raw ─▶                              │
  │                              │── check on-chain price ──────▶
  │                              │◀─ price > 0 ─────────────────│
  │◀── 402 + PaymentRequirement ─│                              │
  │    (programId, skillListing, │                              │
  │     amount, instruction)     │                              │
  │                              │                              │
  │─── call purchaseSkill ───────────────────────────────────────▶
  │                              │           60% → author       │
  │                              │           40% → voucher pool │
  │                              │           Purchase PDA created│
  │                              │                              │
  │─── GET /raw + X-Payment-Proof (buyer, txSig) ──▶           │
  │                              │── derive Purchase PDA ───────▶
  │                              │◀─ PDA exists, buyer matches ─│
  │◀── 200 + SKILL.md content ──│                              │
```

---

## What's Built vs. What's Missing

### Built

- [x] On-chain reputation (register, vouch, revoke, dispute, resolve)
- [x] Skill marketplace (list, update, purchase, claim revenue)
- [x] 60/40 revenue split enforced on-chain
- [x] x402 API payment flow routed through `purchaseSkill`
- [x] Dispute economics (100% slash to challenger + bond return)
- [x] Web UI with trust signals, marketplace, competition page
- [x] Test suites (Anchor program tests, Vitest API/unit tests)

### Not Yet Built

| Gap | Priority | Notes |
|---|---|---|
| **Transitive trust (sanad chains)** | Medium | Vouches are flat. A chain model (A→B→C) would let reputation propagate and enable "degrees of trust." |
| **Trust threshold ("mutawatir")** | Medium | No formal definition of when a skill is "verified." Could be: N vouches from M unique stakers totaling X SOL. |
| **Code signing / content integrity** | High | VISION.md's #1 problem. Skills are unsigned. Content hash on-chain (IPFS CID) is a partial solution but doesn't verify safety. |
| **Audit trail** | Medium | No record of what a skill accesses at runtime. Out of scope for on-chain, but could be an off-chain attestation layer. |
| **Multi-asset staking (USDC)** | Low | Planned in [docs/multi-asset-staking-and-x402-plan.md](docs/multi-asset-staking-and-x402-plan.md). Deferred. |
| **Oracle-based USD normalization** | Low | Needed if multi-asset staking ships. Deferred to v2.1. |

### Open Design Questions

1. **What makes a skill "trusted"?** We show trust signals but don't have a binary trusted/untrusted classification. Should we? A threshold like "3+ vouchers, 1+ SOL total staked, 0 disputes" would be simple and useful.

2. **Should vouching be transitive?** If A vouches for B and B vouches for C, does A have implicit trust in C? The isnad model says yes. Implementation would require a graph traversal or a cached "trust depth" field.

3. **How do we handle skill versioning and updates?** An author can `update_skill_listing` to change the URI, but there's no version history on-chain. A compromised update to a previously-trusted skill is the attack vector the vision warns about.

4. **Who resolves disputes at scale?** Currently only the program authority (deployer wallet). Options: multi-sig, DAO governance, or algorithmic resolution based on stake-weighted voting.

---

## File Structure

```
programs/reputation-oracle/     Anchor program (Rust)
├── src/instructions/           10 instruction handlers
├── src/state/                  6 account definitions
├── src/events.rs               On-chain events
└── src/lib.rs                  Program entry point

web/                            Next.js application
├── app/                        Pages and API routes
│   ├── api/skills/             Skill CRUD + x402 payment gate
│   ├── api/x402/               Payment verification facilitators
│   ├── competition/            Competition page
│   └── skills/                 Marketplace UI
├── generated/                  Codama-generated TypeScript client
├── hooks/useReputationOracle   Program interaction hook
├── lib/
│   ├── x402.ts                 x402 payment protocol
│   ├── onchain.ts              On-chain price fetching
│   ├── pricing.ts              Centralized pricing constants
│   └── competition.ts          Competition config and helpers
└── public/skill.md             Agent integration docs

tests/                          Anchor program tests (Mocha/Chai)
web/__tests__/                  Web tests (Vitest)
```

---

## Deployment

| Component | Target | Status |
|---|---|---|
| Solana Program | Devnet | Deployed |
| Web App | Vercel | Deployed at agentvouch.xyz |
| Program Authority | Deployer wallet | Only wallet that can resolve disputes and init config |

Mainnet deployment requires: security audit, multi-sig authority, and a migration plan for existing devnet state.
