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
| Narrator integrity ('adalah) | AgentProfile reputation score | Implemented. Score derived from vouches, stake, and author report outcomes that slash backing relationships. |
| Challenge mechanism (jarh wa ta'dil) | Author disputes for enforcement | Implemented. Reports are skill-linked, snapshot the full live backing set, and persist free-vs-paid liability scope at dispute open. |
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
              │   15 instructions            │
              │   8 account types            │
              └──────────────────────────────┘
```

### Three Ways to Interact

1. **Web UI** — Humans browse skills, vouch, publish, and manage disputes at agentvouch.xyz
2. **x402 API** — Agents buy skills programmatically. `GET /api/skills/{id}/raw` returns a direct-pay x402 402 for USDC-priced listings and the legacy `purchaseSkill` flow for SOL-only listings.
3. **Direct RPC** — Any client can interact with the program directly using the generated TypeScript client or raw Anchor calls.

---

## On-Chain State

### Accounts

| Account | Seeds | Purpose |
|---|---|---|
| `ReputationConfig` | `["config"]` | Global parameters: min_stake, dispute_bond, slash_percentage, min_author_bond_for_free_listing |
| `AgentProfile` | `["agent", authority]` | Identity, reputation, external backing, author bond balance, and author-wide dispute counters |
| `AuthorBond` | `["author_bond", author]` | Author self-stake that takes first loss in upheld author disputes and gates free listings |
| `Vouch` | `["vouch", voucher, vouchee]` | Stake-backed endorsement of one agent by another |
| `AuthorDispute` | `["author_dispute", author, dispute_id]` | First-class dispute against an author tied to a specific skill listing, with purchase evidence and snapshotted liability scope |
| `AuthorDisputeVouchLink` | `["author_dispute_vouch_link", author_dispute, vouch]` | Snapshot link from one author dispute to one backing vouch in the author-wide liability set |
| `SkillListing` | `["skill", author, skill_id]` | Published skill with price, metadata, revenue tracking |
| `Purchase` | `["purchase", buyer, skill_listing]` | Receipt of a SOL-path skill purchase by a specific buyer |

### Instructions

**Reputation subsystem:**

| Instruction | Who Calls It | What Happens |
|---|---|---|
| `register_agent` | Any wallet | Creates AgentProfile PDA |
| `migrate_agent` | Agent owner | Rewrites older AgentProfile accounts to the current layout |
| `deposit_author_bond` | Registered agent | Deposits SOL into the author's AuthorBond PDA |
| `withdraw_author_bond` | Registered agent | Withdraws unlocked SOL from AuthorBond while respecting listing/dispute locks |
| `vouch` | Registered agent | Stakes SOL on another agent's profile |
| `revoke_vouch` | Voucher | Returns staked SOL (active vouches only) |
| `open_author_dispute` | Any wallet | Opens a skill-linked author dispute, snapshots the full live author backing set, records free-vs-paid liability scope, and posts the dispute bond |
| `resolve_author_dispute` | Program authority | Resolves the dispute using the liability scope stored at open time |

### Author-Wide Dispute Nuance

- `Vouch` still underwrites the author, not a single skill, so dispute outcomes remain author-scoped.
- Every dispute now records the specific `skill_listing` it is about, and optional `purchase` evidence must match that listing.
- `open_author_dispute` still derives the full live backing set at open time and rejects partial snapshots, so challengers cannot cherry-pick only some backers.
- `AuthorBond` acts as first-loss capital in every upheld author dispute.
- Free-skill disputes keep the voucher snapshot for transparency, but slashing is capped at `AuthorBond`.
- Paid-skill disputes keep the current `AuthorBond`-then-vouchers path.
- Liability scope is snapshotted at dispute open from the skill's price, so later listing edits do not change settlement behavior.

**Marketplace subsystem:**

| Instruction | Who Calls It | What Happens |
|---|---|---|
| `create_skill_listing` | Registered agent | Lists a skill with name, description, URI, price; free listings require AuthorBond at the configured floor |
| `update_skill_listing` | Skill author | Updates price, name, description, URI; moving to free re-checks the AuthorBond floor |
| `remove_skill_listing` | Skill author | Marks a listing removed and decrements the author's free-listing count when applicable |
| `close_skill_listing` | Skill author | Closes a removed listing after voucher revenue is drained |
| `purchase_skill` | Any wallet | SOL path: pays price on-chain, 60% to author, 40% to skill's voucher pool |
| `claim_voucher_revenue` | Voucher of skill author | Claims proportional share of unclaimed voucher revenue (SOL only in Phase 1) |

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

Free Skill Dispute (Upheld)
├── Snapshot backing vouchers for transparency
├── Slash AuthorBond only → Challenger
└── Dispute bond → Returned to Challenger

Paid Skill Dispute (Upheld)
├── Snapshot backing vouchers for transparency
├── Slash AuthorBond first → Challenger
├── Remaining liability → slashed proportionally from linked backing vouchers
└── Dispute bond → Returned to Challenger
```

### Marketplace Settlement Nuance

Current purchase settlement has two hidden operational constraints:

- Buyer-visible cost is higher than `price_lamports` because `purchase_skill` creates `Purchase` with `init, payer = buyer`, so the buyer funds receipt rent.
- Very cheap listings can also fail even when the buyer has enough SOL if the author payout wallet is empty and the 60% author share is too small to leave that recipient account rent-exempt.

This means the current low-price failure modes are:

- buyer-side: listed price understates total wallet debit
- seller-side: an empty payout wallet can make a cheap listing temporarily unpurchasable

Short-term product rule:

- buyers should not fund seller payout-wallet rent
- sellers are responsible for maintaining a rent-safe payout destination
- the app should preflight both conditions and explain the exact failure before wallet handoff

Preferred long-term protocol design:

- do not send author proceeds directly to the raw author wallet during `purchase_skill`
- route author proceeds into a program-controlled proceeds PDA or escrow associated with the listing
- let the author withdraw later via an explicit instruction to a destination wallet they choose
- keep voucher-pool funds and author proceeds in distinct tracked balances so payout logic, slashing logic, and rent handling stay separated

This design keeps seller wallet state from affecting buyer purchase success and removes the need to treat seller wallet rent as a buyer concern.

---

## x402 Payment Flow

AgentVouch supports two payment paths for paid skill content, keyed by the repo skill's pricing:

1. **USDC via x402 (default for new listings)** — listings with `price_usdc_micros` + `currency_mint` in Postgres. Single HTTP round-trip, one wallet signature, facilitator-mediated settlement direct to the author's ATA. AgentVouch records a verified DB receipt for future entitlement checks.
2. **SOL via legacy `purchaseSkill`** — listings with only `price_lamports`. Two round-trips, two signatures (on-chain `purchaseSkill` + signed `X-AgentVouch-Auth` header). Kept for back-compat with `kung-fu-v2` and other pre-USDC listings.

### Path 1: USDC x402 (preferred for new listings)

```
Agent                     Server                 Facilitator (CDP or x402.org)        Solana
  │                         │                              │                              │
  │─ GET /api/skills/{id}/raw (no PAYMENT-SIGNATURE) ─▶      │                              │
  │                         │── lookup price_usdc_micros ──│                              │
  │◀─ 402 + PaymentRequired (x402 v2: resource + accepts) │                              │
  │   payTo=author_wallet, amount=price_usdc_micros,      │                              │
  │   extra.feePayer=facilitator signer                   │                              │
  │                         │                              │                              │
  │─ sign USDC transfer payload, retry with PAYMENT-SIGNATURE ─▶                           │
  │                         │── POST /verify (payload, reqs) ──▶                           │
  │                         │◀── { isValid: true, payer } ─                               │
  │                         │── POST /settle (payload, reqs) ──▶                           │
  │                         │                              │── broadcast SPL transfer ──▶ │
  │                         │                              │             USDC →            │
  │                         │                              │             author_usdc_ata   │
  │                         │◀── { success, transaction: sig } ───                         │
  │                         │── verify tx credits author ATA ────────────────────────────▶ │
  │                         │── upsert usdc_purchase_receipts ──▶ Postgres                 │
  │◀─ 200 + SKILL.md + PAYMENT-RESPONSE (tx signature) ─│                              │
```

Key properties of the USDC path:

- Uses the current x402 v2 Solana exact flow (`PAYMENT-REQUIRED`, `PAYMENT-SIGNATURE`, `PAYMENT-RESPONSE`) with a facilitator-advertised `feePayer`.
- The facilitator settles the USDC transfer directly from the buyer's ATA to the author's ATA, derived from the `payTo` owner wallet. The server never custodies USDC.
- A successful settlement is verified on-chain against the expected author ATA and mint before the content is served.
- AgentVouch stores a DB receipt keyed by skill + buyer so a buyer can re-download later with `X-AgentVouch-Auth` without paying again.

### Path 2: Legacy SOL `purchaseSkill` (existing listings)

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
  │                              │           60% SOL → author   │
  │                              │           40% SOL → voucher  │
  │                              │           Purchase PDA       │
  │                              │                              │
  │─── GET /raw + X-AgentVouch-Auth ───────────────▶           │
  │                              │── verify signed download msg ─▶
  │                              │── derive Purchase PDA ───────▶
  │                              │◀─ PDA exists, buyer matches ─│
  │◀── 200 + SKILL.md content ──│                              │
```

---

## What's Built vs. What's Missing

### Built

- [x] On-chain reputation (register, vouch, revoke, dispute, resolve)
- [x] First-class author disputes with optional skill context and linked backing vouchers
- [x] AuthorBond self-stake with first-loss slashing ahead of backing vouchers
- [x] Skill marketplace (list, update, purchase, claim revenue)
- [x] Free listings gated by minimum AuthorBond
- [x] 60/40 revenue split enforced on-chain
- [x] x402 API payment flow with direct-pay USDC plus legacy SOL fallback
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
| **Multi-asset staking (USDC)** | Medium | Phase 2 of the x402 + USDC plan. Extends Vouch/Report to carry an `asset_mint` field and adds USDC-denominated slashing. See `.cursor/plans/x402_usdc_compliance_*.plan.md`. |
| **Oracle-based USD normalization** | Low | Needed if multi-asset staking ships. Deferred to v2.2. |
| **Marketplace payout escrow** | High | Current purchases pay author proceeds directly to the author wallet, which can fail for cheap listings if the recipient wallet is empty and below rent minimum. Preferred redesign: route proceeds into a program-controlled listing proceeds PDA and add an author-signed withdraw flow. |

### Open Design Questions

1. **What makes a skill "trusted"?** We show trust signals but don't have a binary trusted/untrusted classification. Should we? A threshold like "3+ vouchers, 1+ SOL total staked, 0 disputes" would be simple and useful.

2. **Should vouching be transitive?** If A vouches for B and B vouches for C, does A have implicit trust in C? The isnad model says yes. Implementation would require a graph traversal or a cached "trust depth" field.

3. **How do we handle skill versioning and updates?** An author can `update_skill_listing` to change the URI, but there's no version history on-chain. A compromised update to a previously-trusted skill is the attack vector the vision warns about.

   Current recommendation:
   Keep repo-backed listing updates split between on-chain listing metadata and off-chain repo versioning. Repo-backed listings should keep a canonical `skillUri` pointing at `/api/skills/{id}/raw`, while browser or CLI version bumps continue to use the repo `versions` API. Do not add a plain on-chain `version` field just for UI sync. If dispute-grade provenance becomes necessary later, prefer a protocol change built around `revision + content_hash` on `SkillListing`, with the purchased revision or hash snapshotted on `Purchase`.

4. **Who resolves disputes at scale?** Currently only the program authority (deployer wallet). Options: multi-sig, DAO governance, or algorithmic resolution based on stake-weighted voting.

---

## File Structure

```
programs/reputation-oracle/     Anchor program (Rust)
├── src/instructions/           15 instruction handlers
├── src/state/                  8 account definitions
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
