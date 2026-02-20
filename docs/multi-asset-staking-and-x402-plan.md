# AgentVouch v2 Plan: Multi-Asset Staking + x402 Payments

**Status:** Draft implementation plan  
**Author:** Sparky  
**Date:** 2026-02-20

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

## 3.2 Payment adapter changes

Introduce a payment adapter layer:
- `record_skill_purchase(payment_ref, mint, amount, buyer, seller, skill_id)`
- split revenue (60/40) in paid asset
- optionally route % into stake reserve per policy

## 3.3 Valuation strategy

v2.0:
- Store and expose per-asset stake.
- Compute USD views off-chain in indexer/UI.

v2.1 (optional):
- Add oracle-backed normalization with stale-price guards.

---

## 4) Implementation Phases

## Phase 1 — State Model Refactor (No behavior change)

### Objective
Refactor account schemas to support multi-asset stake while preserving SOL-only runtime behavior.

### Deep reasoning
Do schema work first to reduce risk. If we add USDC before schema is solid, we will duplicate logic and create hidden invariants.

### Deliverables
- New stake position structs and enums.
- Account versioning (`v1` compatibility + `v2` state).
- Event schema updates with `mint`.

### Exit criteria
- Existing SOL stake/vouch flows pass unchanged behavior tests.

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

## 5.1 Protocol / Program

- [ ] Add `StakePosition` and role enums.
- [ ] Add account versioning and decode paths for v1/v2.
- [ ] Implement per-mint vault PDA derivation strategy.
- [ ] Add mint allowlist config account and admin controls.
- [ ] Implement `stake_token` / `unstake_token`.
- [ ] Generalize `stake_sol` to shared validation path.
- [ ] Update dispute lock/unlock model to include mint context.
- [ ] Implement generalized slashing execution.
- [ ] Emit enriched events: `mint`, `amount`, `role`, `position_id`.

## 5.2 Security

- [ ] Reentrancy and CPI abuse review for token flows.
- [ ] Vault authority and signer constraints audit.
- [ ] Mixed-mint slashing fuzz tests.
- [ ] Freeze/blacklist token edge-case policy (USDC controls).
- [ ] Incident runbook for mint deprecation.

## 5.3 Marketplace / x402 Adapter

- [ ] Define x402 payment proof format accepted by adapter.
- [ ] Implement adapter verification + settlement record.
- [ ] Integrate 60/40 split in arbitrary supported mint.
- [ ] Add optional auto-stake routing policy.
- [ ] Build reconciliation script (events vs balances).

## 5.4 Indexer / API / UI

- [ ] Extend indexer schema for multi-mint positions.
- [ ] Add endpoints for stake composition by agent.
- [ ] Add UI cards for per-mint stake and composition pie.
- [ ] Add warnings for unsupported/stale/disabled mints.
- [ ] Add explorer links for mint metadata and vault addresses.

## 5.5 Migration / Ops

- [ ] Write migration plan doc (v1 -> v2 account map).
- [ ] Build dry-run migrator with diff output.
- [ ] Run migration on local validator snapshot.
- [ ] Run migration on devnet test cohort.
- [ ] Publish rollback criteria and execution checklist.

## 5.6 Testing / QA

- [ ] Unit tests for all stake operations by mint.
- [ ] Property tests for slashing invariants.
- [ ] Devnet integration suite for SOL+USDC mixed flows.
- [ ] Load tests for event/indexer throughput.
- [ ] Manual QA scripts for purchase/dispute settlement.

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

- % of total stake represented in stable assets.
- Successful mixed-mint dispute resolutions.
- x402 purchase success rate and reconciliation integrity.
- Time-to-detect for broken payment/mint routes.
- Agent adoption: # agents with >1 supported stake asset.

---

## 9) Non-Goals (for this milestone)

- Full oracle-based on-chain USD normalization (defer to v2.1).
- Support for every stablecoin at launch.
- Cross-chain collateral in core program (can be future adapter layer).

---

## 10) Immediate Next Actions (This Week)

- [ ] Finalize v2 account schema draft (`StakePosition`, vault model, versioning).
- [ ] Decide mixed-collateral slashing policy (proportional vs ordered).
- [ ] Implement mint allowlist + USDC integration on devnet.
- [ ] Write x402 adapter interface spec.
- [ ] Produce migration dry-run prototype and test against current devnet state.

---

## Appendix A — Recommended Technical Stance

If we must choose now between “SOL-only + oracle” and “multi-mint + stablecoin-first”, choose:

> **Multi-mint core + stablecoin support now, oracle normalization later.**

Reason: this gets stable economic semantics and future-proof architecture quickly, while avoiding unnecessary oracle coupling in the trust-critical core.
