---
name: ""
overview: ""
todos: []
isProject: false
---

# AgentVouch v2 Plan: Multi-Asset Staking + x402 Payments

**Status:** In progress (`Phase 0` complete; `x402` adapter partially shipped; multi-mint refactor still pending)  
**Author:** Sparky  
**Date:** 2026-02-20  
**Last revised:** 2026-03-17

---

## 0) Executive Summary

We can support **USDC/stablecoin staking** and **x402-based skill payments** **without** a full program rewrite.

The core move is to refactor AgentVouch from a SOL-only staking model to a **multi-mint stake position model** while keeping dispute/slashing semantics intact.

### Guiding decisions

1. **Do now:** Multi-mint staking architecture + USDC support.
2. **Do now:** Marketplace adapter path for x402 payments.
3. **Do later:** On-chain USD normalization via oracle (keep valuation off-chain in v2.0).

This gives us future-proofing now, with low enough risk to ship incrementally.

---

## 1) Problem Statement

### Current pain

- Staking is SOL-only; value-at-risk is volatile in USD terms.
- Marketplace payment rails are tightly coupled to current payment assumptions.
- Future token/payment support risks becoming bolt-on tech debt.

### Why this matters

Agent reputation is only meaningful if stake is both:

- **Economically legible** (users understand what is at risk), and
- **Operationally composable** (agents can pay/use skills via modern rails like x402).

---

## 2) Design Principles (Deep Constraints)

1. **Execution > aesthetics**
  - Program state should represent what can be enforced on-chain, not what is easy to market.
2. **Compatibility first**
  - Existing SOL stakes and vouches must remain valid or migrate safely.
3. **No mandatory oracle in v2 core**
  - Oracle dependency adds liveness and trust assumptions; defer to v2.1 unless required.
4. **Payment rail != reputation core**
  - x402 is a payment interface; keep it decoupled from slashing/dispute accounting logic.
5. **Observability by default**
  - Every economic action emits events with enough metadata to reconstruct reputation off-chain.

---

## 3) Target Architecture

## 3.1 Core program changes

Move from:

- `stake_lamports: u64`

to:

- `StakePosition { mint, amount, role, lock_state, created_at }`

Where:

- `mint: Pubkey` (e.g., SOL pseudo-mint convention or SPL mint like USDC)
- `amount: u64` (raw units)
- `role: VouchStake | DisputeBond | FeeReserve`
- `lock_state: Unlocked | Locked(dispute_id)`

Use per-mint vault PDAs/ATAs for custody.

### 3.1.1 SOL representation decision

**Decision: Use Wrapped SOL (So11111111111111111111111111111111111111112)**

All stake positions use SPL token accounts uniformly. SOL stakes are wrapped on deposit and unwrapped on withdrawal. This avoids branching logic between native SOL and SPL paths throughout the program.

Trade-off: slightly more UX friction (wrapping step), but dramatically simpler program code and fewer edge cases in slashing/vault logic.

### 3.1.2 Position cardinality

One `StakePosition` PDA per (vouch, mint) pair. An agent vouching with both SOL and USDC creates two position accounts. Max positions per vouch is bounded by the mint allowlist size (governance-controlled, starting at 2: wSOL + USDC).

Rent impact: ~~82 bytes per position vs 8 bytes for the current `stake_amount: u64`. At 2 positions per vouch, worst case ~164 bytes additional rent (~~0.001 SOL). Acceptable.

### 3.1.3 Slashing policy (default)

**Decision: Proportional slashing across mints.**

When a vouch is slashed, each position under that vouch is slashed by `slash_percentage` of its amount. This is simpler, fairer, and avoids ordering ambiguity.

Example: vouch has 1 SOL + 100 USDC staked, slash_percentage = 50% → slash 0.5 SOL + 50 USDC.

This can be overridden by governance in a future version (e.g., slash stablecoins first). The default must be deterministic and easy to verify.

## 3.2 Payment adapter changes

Introduce a payment adapter layer:

- `record_skill_purchase(payment_ref, mint, amount, buyer, seller, skill_id)`
- split revenue (60/40) in paid asset
- optionally route % into stake reserve per policy

### 3.2.1 x402 Integration Spec (v2.0)

#### A) Accepted Payment Requirements schema

AgentVouch adapter should accept x402-style requirements with explicit, typed fields:

- `scheme`: `exact` (required in v2.0)
- `network`: `solana`
- `mint`: SPL mint pubkey (USDC first, allowlist-gated)
- `amount`: integer in base units (no floats)
- `recipient`: settlement vault or seller destination
- `resource`: canonical resource identifier (`skill_id`, endpoint route, or purchase intent id)
- `expiry`: unix timestamp
- `nonce`: replay protection token
- `metadata`: optional map for UI/display only (non-authoritative)

Validation rules:

- Reject unknown scheme values in v2.0.
- Reject unsupported mints (must be allowlisted).
- Reject expired requirements.
- Bind requirement to a canonical `resource` hash to prevent cross-endpoint replay.

#### B) Verification/settlement interface compatibility

Adapter should support two integration modes:

1. **Native mode (minimal verifier)**
  - Verify proof against Solana transaction data + program/account constraints.
  - Settle by writing a deterministic purchase record and payout entries.
2. **Facilitated mode (optional)**
  - Compatibility shims for common x402 facilitator patterns:
    - `POST /verify`
    - `POST /settle`
    - optional `GET /supported`

Canonical adapter outputs:

- `verification_status`: `valid | invalid | pending`
- `payment_ref`: deterministic id (tx sig + instruction index + resource hash)
- `settlement_id`: unique settlement record id
- `final_amount`, `final_mint`, `final_recipient_set`

Idempotency:

- `/verify` and `/settle` must be safe to retry.
- duplicate `payment_ref` must return prior result, never double-settle.

#### C) Conformance test vectors

Maintain a test vector suite that runs against at least one external x402 SDK implementation (Coinbase-targeted first), then expands.

Minimum vectors:

- Valid exact payment (happy path)
- Invalid signature/header encoding
- Wrong mint / unsupported mint
- Wrong amount (off by 1)
- Expired requirement
- Replay attack attempt (`nonce` reuse)
- Double-settlement attempt (idempotency)
- Resource mismatch replay (pay once, attempt access to different resource)

Pass criteria:

- Adapter verdict matches expected outcome for every vector.
- No vector can produce duplicate settlement side effects.

### 3.2.2 Settlement failure handling

- **Settlement timeout**: If the Solana tx confirms but the adapter's `/settle` call fails, the settlement record is written with `status: pending`. A background reconciler retries pending settlements.
- **Partial settlement**: If the 60/40 split partially succeeds (e.g., author paid but voucher pool write fails), the settlement is marked `partial_failure`. Reconciliation script detects and replays the failed leg. No manual intervention for single-leg failures.
- **Settlement status enum**: `pending | complete | partial_failure | failed`
- **Access control**: Facilitator-mode endpoints (`/verify`, `/settle`) require API key authentication. Unauthenticated callers cannot use the adapter as a free proof-of-payment oracle.

## 3.3 Valuation strategy

v2.0:

- Store and expose per-asset stake.
- Compute USD views off-chain in indexer/UI.

v2.1 (optional):

- Add oracle-backed normalization with stale-price guards.

## 3.4 Multichain groundwork (Solana now, EVM next)

### Strategic separation (must preserve)

Keep these layers decoupled:

1. **Reputation core** — vouch, dispute, slash, and scoring semantics.
2. **Payment rails** — x402, marketplace payments, facilitators.
3. **Chain settlement adapters** — Solana adapter today, Base/EVM adapters later.

This prevents per-chain rewrites and keeps expansion additive.

### Non-negotiable data model rules

- Represent stake as `**{chain, asset, amount}`** (not just amount).
- Represent payment/stake proofs as **verifiable claim format**, not Solana-only structs.
- Keep dispute/slash policy chain-agnostic; execution is adapter-specific.
- Use canonical cross-chain IDs for agents/skills:
  - `namespace:chain:contract#id`
- Treat indexer/event layer as source for global cross-chain reputation view.

### Immediate v2.0 action to lock this in

Add explicit `chain_context` to all core records now (even if value is always `solana` initially):

- stake positions
- payment/settlement records
- dispute/slash records
- emitted events

This is a small schema choice now that avoids a painful migration later.

## 3.5 Event schema (v2.0)

The current program uses `msg!` only — no structured events. v2 must use Anchor `#[event]` macros so indexers can subscribe reliably.


| Event                  | Fields                                                                                                                  |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `StakeDeposited`       | `vouch: Pubkey, mint: Pubkey, amount: u64, role: StakeRole, chain_context: String, position_id: Pubkey`                 |
| `StakeWithdrawn`       | `vouch: Pubkey, mint: Pubkey, amount: u64, chain_context: String, position_id: Pubkey`                                  |
| `StakeSlashed`         | `vouch: Pubkey, dispute: Pubkey, mint: Pubkey, amount_slashed: u64, chain_context: String`                              |
| `DisputeOpened`        | `dispute: Pubkey, vouch: Pubkey, challenger: Pubkey, bond_mint: Pubkey, bond_amount: u64, chain_context: String`        |
| `DisputeResolved`      | `dispute: Pubkey, ruling: DisputeRuling, chain_context: String`                                                         |
| `SkillPurchased`       | `purchase: Pubkey, skill: Pubkey, buyer: Pubkey, mint: Pubkey, amount: u64, payment_ref: String, chain_context: String` |
| `RevenueDistributed`   | `skill: Pubkey, mint: Pubkey, author_amount: u64, voucher_pool_amount: u64, chain_context: String`                      |
| `MintAllowlistUpdated` | `mint: Pubkey, action: AllowlistAction, authority: Pubkey`                                                              |


All events include `chain_context` from day one. Indexer team can build against this schema in parallel with program work.

---

## 4) Implementation Phases

## Phase 0 — Prerequisites (Fix v1 gaps before refactoring)

### Objective

Ship the missing `claim_voucher_revenue()` instruction and replace `msg!` logging with Anchor events. These are prerequisites — refactoring revenue splits to multi-mint is meaningless without a working claim mechanism, and the indexer needs structured events.

### Historical state before Phase 0 work (2026-02-25)

- `cumulative_revenue` and `last_payout_at` fields exist on Vouch but are **never written to**.
- `purchase_skill` calculates 40% voucher pool but **does not distribute or record it**.
- No Anchor `#[event]` structs — only `msg!` logging.
- No account versioning.

### Deliverables

- `claim_voucher_revenue()` instruction: vouchers claim proportional share of the 40% pool based on stake weight.
- Fix `purchase_skill` to actually write `cumulative_revenue` on each vouch for the purchased skill's author.
- Replace all `msg!` logging with Anchor `emit!` events (use v1 event schema — `mint` field can be hardcoded to `native` for now).

### Exit criteria

- Voucher can claim accumulated revenue on devnet (end-to-end: purchase → claim → balance check).
- Events are parseable by a test indexer subscriber.

---

## Phase 1 — State Model Refactor (No behavior change)

### Objective

Refactor account schemas to support multi-asset stake while preserving SOL-only runtime behavior.

### Deep reasoning

Do schema work first to reduce risk. If we add USDC before schema is solid, we will duplicate logic and create hidden invariants.

### Deliverables

- New stake position structs and enums.
- Account versioning (`v1` compatibility + `v2` state).
- Event schema updates with `mint` and `chain_context`.

### Exit criteria

- Existing SOL stake/vouch flows pass unchanged behavior tests.
- v1 accounts decode correctly through v2 code paths.

---

## Phase 2 — Multi-Mint Vaults + USDC staking

### Objective

Enable stake/unstake for SPL mints (starting with USDC).

### Deep reasoning

USDC adds real-world value stability quickly; doing one mint first gives a practical pattern without over-generalizing.

### Deliverables

- Per-mint vault initialization logic.
- `stake_token(mint, amount)` and `unstake_token(...)` instructions.
- Mint allowlist governance config.

### Exit criteria

- End-to-end USDC stake lifecycle on devnet.
- Slashing path can debit correct mint vault.

---

## Phase 3 — Disputes/Slashing generalized to asset-aware rules

### Objective

Ensure disputes and slashing work consistently across SOL + USDC stakes.

### Deep reasoning

If slashing semantics lag behind staking semantics, reputation claims become hollow. Economic accountability is the product.

### Deliverables

- Asset-aware slashing resolver.
- Policy for mixed collateral (e.g., slash oldest-first or proportional by mint).
- Deterministic dispute settlement order.

### Exit criteria

- Property tests for mixed-mint stake sets.
- No underflow/rounding failures in slashing math.

---

## Phase 4 — x402 payment adapter for skill purchases

### Objective

Support skill purchases via x402-compatible payment flows.

### Deep reasoning

Treat payment integration as an adapter, not a rewrite of reputation logic. This keeps the trust core clean and testable.

### Deliverables

- x402 payment ingest/verification adapter.
- Marketplace settlement in paid asset.
- Optional policy hooks: auto-stake slice, fee routing.

### Exit criteria

- Purchase flow succeeds with on-chain settlement records.
- Revenue split and accounting reconciles against events.

---

## Phase 5 — Indexer/UI + migration tooling

### Objective

Make multi-asset reputation legible and migrate existing state safely.

### Deep reasoning

Shipping protocol changes without legible UX destroys trust. If users can’t verify stake composition, they won’t trust scores.

### Deliverables

- Indexer support for per-mint stake reporting.
- UI views: per-mint, aggregate, historical stake changes.
- Migration script(s) + dry-run tool.

### Exit criteria

- One-click migration report for all existing accounts.
- UI shows stake composition for top agents.

---

## 5) Detailed TO-DO Checklist

## 5.0 Phase 0 Prerequisites

- Implement `claim_voucher_revenue()` instruction (proportional by stake weight).
- Fix `purchase_skill` to update `cumulative_revenue` on vouches for the skill author.
- Add Anchor `#[event]` structs and replace `msg!` logging with `emit!`.
- Add integration test: purchase skill → claim revenue → verify balances.

## 5.1 Protocol / Program

- Add `StakePosition` and role enums.
- Add explicit `chain_context` to stake/payment/dispute schemas (default `solana` in v2.0).
- Add account versioning and decode paths for v1/v2.
- Implement per-mint vault PDA derivation strategy.
- Add mint allowlist config account and admin controls.
- Implement `stake_token` / `unstake_token`.
- Generalize `stake_sol` to shared validation path.
- Update dispute lock/unlock model to include mint context.
- Implement generalized slashing execution.
- Emit enriched events: `mint`, `amount`, `role`, `position_id`.

## 5.2 Security

- Reentrancy and CPI abuse review for token flows.
- Vault authority and signer constraints audit.
- Mixed-mint slashing fuzz tests.
- Freeze/blacklist token edge-case policy (USDC controls).
- Incident runbook for mint deprecation.

## 5.3 Marketplace / x402 Adapter

Current repo status: partial groundwork is shipped in `web/lib/x402.ts`, `/api/x402/{verify,settle,supported}`, and `/api/skills/[id]/raw`, but the adapter is still Solana-only and does not yet satisfy the full checklist below.

- Define accepted x402 Payment Requirements schema (`scheme`, `network`, `mint`, `amount`, `recipient`, `resource`, `expiry`, `nonce`).
- Enforce strict validation rules (allowlisted mint, non-expired, exact amount, canonical resource hash binding).
- Implement native adapter verify flow (Solana tx/proof validation).
- Implement settlement flow with deterministic `payment_ref` and idempotent `settlement_id`.
- Add compatibility layer for facilitator-style endpoints (`/verify`, `/settle`, optional `/supported`).
- Integrate 60/40 split in arbitrary supported mint.
- Add optional auto-stake routing policy.
- Build reconciliation script (events vs balances).
- Build conformance test vectors against at least one external x402 SDK (Coinbase-targeted first).
- Add replay and double-settlement tests (`nonce` reuse, duplicate `payment_ref`, resource mismatch replay).

## 5.4 Indexer / API / UI

Current repo status: partial groundwork exists because `skills.chain_context` is already stored in Postgres, but there is no multi-mint indexer schema or cross-chain identity support yet.

- Extend indexer schema for multi-mint positions with `chain_context`.
- Add canonical cross-chain ID support (`namespace:chain:contract#id`) for agents/skills.
- Add endpoints for stake composition by agent.
- Add UI cards for per-mint stake and composition pie.
- Add warnings for unsupported/stale/disabled mints.
- Add explorer links for mint metadata and vault addresses.

## 5.5 Migration / Ops

Current repo status: planning exists, but migration tooling and execution are still pending.

- Write migration plan doc (v1 -> v2 account map).
- Build dry-run migrator with diff output.
- Run migration on local validator snapshot.
- Run migration on devnet test cohort.
- Publish rollback criteria and execution checklist.
- Document upgrade authority plan (single key now, multisig path for mainnet).
- Define zero-downtime migration strategy: v2 program reads both v1 and v2 account formats via versioned deserialization. No program pause required.
- Define mint removal policy: grace period → freeze new stakes → forced unstake deadline → remove from allowlist.

## 5.6 Testing / QA

- Unit tests for all stake operations by mint.
- Property tests for slashing invariants.
- Devnet integration suite for SOL+USDC mixed flows.
- Load tests for event/indexer throughput.
- Manual QA scripts for purchase/dispute settlement.

---

## 6) Risks and Mitigations

### Risk A: Token complexity creates exploit surface

**Mitigation:** strict mint allowlist, minimal CPI surface, external audit before mainnet.

### Risk B: Mixed collateral policy confusion

**Mitigation:** publish deterministic slashing policy + UI explanation + simulator.

### Risk C: USDC centralization/freeze risk

**Mitigation:** governance-controlled supported mint list, explicit risk labeling, optional alternatives.

### Risk D: Migration bugs

**Mitigation:** versioned accounts, dry-run tooling, reversible rollout gates.

### Risk E: x402 verification ambiguity

**Mitigation:** adapter schema lock + conformance test vectors.

### Risk F: Building on broken foundation (v1 revenue gap)

`claim_voucher_revenue()` is unimplemented and `cumulative_revenue` is never written. Shipping multi-mint on top of a broken revenue path compounds the problem.
**Mitigation:** Phase 0 fixes this before any refactoring begins. No Phase 1 work starts until claim flow works end-to-end on devnet.

---

## 7) Rollout Strategy

1. **Devnet internal alpha**
  - SOL compatibility + USDC staking only.
2. **Devnet public beta**
  - Enable x402 adapter behind feature flag.
3. **Stability window**
  - 2 weeks with dispute/slash simulations.
4. **Mainnet candidate**
  - External review + migration readiness sign-off.
5. **Mainnet phased launch**
  - mint allowlist starts with USDC + SOL, expand later.

---

## 8) Success Metrics

All baselines measured from devnet beta launch date (T+0).


| Metric                                      | Target (T+30 days) | Target (T+90 days) |
| ------------------------------------------- | ------------------ | ------------------ |
| % of total stake in stable assets           | >10%               | >30%               |
| Mixed-mint dispute resolutions (successful) | ≥3 simulated       | ≥10 real           |
| x402 purchase success rate                  | >95%               | >99%               |
| Settlement reconciliation errors            | 0                  | 0                  |
| Agents with >1 stake asset                  | ≥5                 | ≥20                |
| Time-to-detect broken mint/payment route    | <1 hour            | <15 min (alerting) |


---

## 9) Non-Goals (for this milestone)

- Full oracle-based on-chain USD normalization (defer to v2.1).
- Support for every stablecoin at launch.
- Cross-chain collateral in core program (can be future adapter layer).
- Account versioning for devnet Phase 1 (clean break — see note below).

---

## 9.1) Versioning Decision: Devnet vs Mainnet

**Devnet (Phase 1): Clean break.** Rewrite account schemas directly, redeploy fresh. No v1/v2 discrimination needed. Existing devnet accounts are test data — recreatable in seconds via the test suite. This keeps Phase 1 simple and focused on getting the schema right.

**Mainnet (future): Versioned deserialization from day one.** When the program ships to mainnet, every account schema must include a version discriminator byte. The program must support reading both current and previous account formats via versioned deserialization, enabling zero-downtime upgrades. This is a hard requirement — mainnet accounts hold real stake and cannot be abandoned.

The versioning infrastructure (version byte, dual decode paths, migration tooling) should be designed and implemented as part of the mainnet readiness phase, not Phase 1.

---

## 10) Immediate Next Actions

### Phase 0 — fix v1 gaps (COMPLETED)

1. ~~**Implement `claim_voucher_revenue()**~~` — Done. 40% voucher pool collects and distributes correctly.
2. ~~**Fix `purchase_skill` revenue tracking**~~ — Done. `cumulative_revenue` and `unclaimed_voucher_revenue` written on purchase.
3. ~~**Add Anchor events**~~ — Done. All `msg!` replaced with `emit!` using structured event types.
4. ~~**Write integration test**~~ — Done. End-to-end purchase → claim → balance verification passes.

### Next: Phase 1 — schema refactor (clean break on devnet)

1. **Draft v2 account schemas** — `StakePosition` struct, vault PDA derivation. Use Wrapped SOL for uniform token handling.
2. **Rewrite account schemas directly** — clean break, no v1 compatibility needed on devnet. Fresh redeploy.
3. **Add `chain_context` and `mint` to all event types** — defaults to `solana` and `native` until Phase 2 activates multi-mint.

### Week after (Phase 2 start)

1. **Implement mint allowlist config** — governance-controlled, starting with wSOL + USDC.
2. **Implement `stake_token` / `unstake_token`** — per-mint vault PDAs with ATA custody.
3. **Deploy USDC staking to devnet** — end-to-end lifecycle test.

---

## Appendix A — Recommended Technical Stance

If we must choose now between “SOL-only + oracle” and “multi-mint + stablecoin-first”, choose:

> **Multi-mint core + stablecoin support now, oracle normalization later.**

Reason: this gets stable economic semantics and future-proof architecture quickly, while avoiding unnecessary oracle coupling in the trust-critical core.