---
name: Pre-Milestone 3 Gates
overview: Lock the remaining protocol, custody, authority, x402, and tooling decisions before the broad Anchor USDC rewrite starts.
todos:
  - id: gate-x402-bridge
    content: Decide x402 bridge POC pass/fail criteria and fallback behavior
    status: pending
  - id: gate-economics
    content: Lock USDC economic constants and reputation calibration inputs
    status: pending
  - id: gate-authorities
    content: Lock authority, treasury, pause, and rotation policy
    status: pending
  - id: gate-vault-lifecycle
    content: Lock PDA token vault lifecycle, close rules, and rent/refund behavior
    status: pending
  - id: gate-reward-index
    content: Lock voucher reward index rules and edge-case behavior
    status: pending
  - id: gate-compute-accounts
    content: Review account-count and compute ceilings before implementing high-account flows
    status: pending
  - id: gate-toolchain
    content: Pin toolchain, generated-client commands, and verification commands
    status: pending
  - id: gate-cutover
    content: Confirm production cutover guardrails and Phantom-facing metadata timing
    status: pending
isProject: false
---

# Pre-Milestone 3 Gates

## Goal

Resolve the design questions that would be expensive to change after the broad Anchor USDC rewrite starts.

Milestone 3 should not begin until each gate below has a concrete decision, acceptance check, and owner for any remaining POC work.

## Source Of Truth

- Durable migration spec: `docs/USDC_NATIVE_MIGRATION.md`
- Protocol spec: `.cursor/plans/usdc_milestone_1_protocol_spec.plan.md`
- Fresh identity handoff: `.cursor/plans/usdc_milestone_2_fresh_program_identity.plan.md`
- New program identity: `agentvouch`
- New program ID: `CVpe18yvJ4nJxHivqu8G85TSKn8YVZcWaVE3z8afrQnW`

## Gate 1 - x402 Bridge

Decision needed:

- Whether `settle_x402_purchase` is included in the first Milestone 3 implementation pass or left behind a feature gate until the POC passes.
- Whether x402 for protocol-listed paid skills is disabled, entitlement-only, or bridge-backed during devnet testing.

Pass criteria:

- x402 payment can be bound to protocol references: version, listing, skill id, buyer, amount, nonce, and timestamp.
- Backend can verify the settled USDC transfer, payer, destination settlement vault, amount, mint, and memo without relying on user-submitted claims.
- `settle_x402_purchase` is idempotent and prevents duplicate purchase or reward-credit creation.
- Failure and refund behavior are documented for facilitator failure, partial settlement, duplicate settlement, stale nonce, wrong amount, wrong mint, and wrong listing.

Fallback:

- If the POC fails, x402 remains repo-only/off-chain entitlement flow for paid skills until a trustless or facilitator-supported protocol call path exists.

## Gate 2 - Economics And Reputation

Lock before coding:

- Minimum listing price: `0.01 USDC` (`10_000` micros), unless explicitly changed before Milestone 3.
- Minimum vouch stake: `1 USDC`.
- Minimum author bond for free listings: `1 USDC`.
- Dispute bond: `0.5 USDC`.
- Author/voucher split: `60%` direct author payout, `40%` listing reward vault.
- Protocol fee: `0%` for `v0.2.0`, with account layout room for a future explicit fee.

Reputation decision needed:

- Exact score formula, caps, integer rounding, overflow bounds, and calibration against the legacy `0.001 SOL` listing floor.
- Whether author bond and voucher stake use the same or separate weighting curves.
- How disputes and slashing reduce score immediately and after any cooldown.

## Gate 3 - Authorities And Treasury

Lock before coding:

- `upgrade_authority`, `config_authority`, `treasury_authority`, `pause_authority`, and `x402_settlement_authority` semantics.
- Devnet authority custody and rotation procedure.
- Mainnet requirement: no single hot wallet controls upgrade/config/treasury/settlement authority after real user funds are accepted.
- Whether treasury withdrawals are disabled on devnet and what approval threshold is required before mainnet.

Config fields affected:

- USDC mint
- token program
- protocol treasury vault
- x402 settlement authority
- x402 settlement vault
- economic floors
- slash percentages
- future protocol fee slots

## Gate 4 - Vault Lifecycle

Lock before coding:

- Per-author author-bond vault creation, close, and rent refund behavior.
- Per-vouch stake vault creation, top-up, slash, revoke, close, and rent refund behavior.
- Per-listing reward vault creation, voucher claim, listing close, stranded dust, and rent refund behavior.
- Per-dispute bond vault creation, upheld/dismissed settlement, close, and rent refund behavior.
- Recipient ATA policy: clients create canonical ATAs idempotently; program validates but does not auto-create recipient ATAs.
- Lost-wallet policy: no admin recovery by default for `v0.2.0`.

## Gate 5 - Reward Index

Lock before coding:

- `ListingVouchPosition` account fields and PDA seeds.
- Reward index scale factor and overflow bounds.
- Purchase-time reward index update formula.
- Link/unlink/revoke behavior for reward debt.
- Eligibility at purchase time, claim time, close time, and dispute/slash time.
- Handling for zero active listing vouch stake on paid listings.

## Gate 6 - Compute And Account Ceilings

Review before coding:

- Maximum accounts for `resolve_author_dispute`, especially when linked vouches and token accounts arrive through `remaining_accounts`.
- Whether dispute resolution needs batching, capped linked-vouch processing, or multiple resolution instructions.
- Compute budget expectations for purchase, settle x402, claim rewards, and dispute flows.
- Test strategy for upper-bound account counts.

## Gate 7 - Toolchain And Generated Artifacts

Pin before coding:

- Anchor: `0.32.1`
- Solana CLI: current repo environment uses `3.1.4`
- Rust/MSRV target for local contributors
- `anchor-spl` version to add in Milestone 3
- SBF build command for deploy artifact generation:

```bash
env -u CARGO_TARGET_DIR cargo build-sbf --manifest-path programs/agentvouch/Cargo.toml
```

Generated artifact flow:

```bash
NO_DNA=1 anchor build
cp target/idl/agentvouch.json web/agentvouch.json
npm exec --workspace @agentvouch/web tsx ./scripts/generate-client.ts
npm run build --workspace @agentvouch/web
```

## Gate 8 - Production Cutover

Confirm before public deployment:

- Production `agentvouch.xyz` stays on the current working flow until `v0.2.0` is deployed, initialized, indexed, and smoke-tested.
- `web/public/skill.md`, `.well-known/agentvouch.json`, public docs, generated IDL/client files, and `@agentvouch/protocol` constants flip together.
- Phantom app acceptance remains tied mostly to domain, app ID, allowlisted URLs, and wallet UX; new program ID exposure waits until the new on-chain flow works.
- Private deploy keypairs remain untracked and out of commits.

## Acceptance Criteria

- Every gate above has a decision recorded in this plan or promoted into `docs/USDC_NATIVE_MIGRATION.md`.
- No gate remains an implementation fork before Milestone 3 begins.
- Milestone 3 can proceed as a broad rewrite without compatibility shims for unresolved SOL-era behavior.

## Verification Commands

```bash
rg "TODO|TBD|unresolved|decide|optional|fork" .cursor/plans/usdc_pre_milestone_3_gates.plan.md docs/USDC_NATIVE_MIGRATION.md
rg "agentvouch|USDC|x402|settlement_authority|ListingVouchPosition" docs/USDC_NATIVE_MIGRATION.md .cursor/plans/usdc_milestone_1_protocol_spec.plan.md
```
