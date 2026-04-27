# USDC Native Migration Plan

## Summary

AgentVouch should move the on-chain trust protocol from SOL-denominated accounting to USDC-denominated accounting.

The current app already supports USDC/x402 for repo-backed skill purchases, but the Anchor program still uses lamports for listing prices, vouches, author bonds, voucher rewards, dispute bonds, and reputation score inputs. Because the currency invariant changes across every trust primitive, this migration should be a fresh program deployment rather than an in-place upgrade.

Versioning decision:

- Current SOL-denominated devnet release: `v0.1.0`.
- USDC-native devnet release: `v0.2.0`.
- First mainnet-ready release: `v1.0.0`.

Implementation decision:

- Build a new USDC-first program in this repo.
- Use a fresh program deploy keypair and new program ID for `v0.2.0`.
- Treat existing devnet accounts as disposable test data.
- Preserve useful app/API/x402 code, but do not preserve `v0.1.0` account layouts or SOL purchase semantics in the new program.
- Use native Circle USDC as the protocol settlement asset.

## Current State

### USDC Already Implemented

USDC support exists in the web/API layer:

- `skills.price_usdc_micros`
- `skills.currency_mint`
- `usdc_purchase_receipts`
- `usdc_purchase_entitlements`
- x402 direct USDC payment requirements
- facilitator verify/settle flow
- signed raw skill download after entitlement

Primary files:

- `web/app/api/skills/route.ts`
- `web/app/api/skills/[id]/raw/route.ts`
- `web/lib/x402.ts`
- `web/lib/usdcPurchases.ts`
- `web/lib/browserX402.ts`

### SOL Still In The Protocol

The `v0.1.0` Anchor program is SOL/lamports-only:

- `SkillListing.price_lamports`
- `SkillListing.total_revenue`
- `SkillListing.unclaimed_voucher_revenue`
- `Vouch.stake_amount`
- `Vouch.cumulative_revenue`
- `AgentProfile.total_staked_for`
- `AgentProfile.author_bond_lamports`
- `AuthorBond.amount`
- `ReputationConfig.min_stake`
- `ReputationConfig.dispute_bond`
- `ReputationConfig.min_author_bond_for_free_listing`
- `Purchase.price_paid`
- dispute snapshots and slashing amounts

The program currently depends on `anchor-lang` only. It does not use `anchor-spl`, SPL Token, ATAs, token vaults, or USDC mint validation.

## Target Model

The USDC-native `v0.2.0` program should use micro-USDC as the only protocol money unit.

Naming convention:

- Store protocol amounts as `u64`.
- Use `*_usdc_micros` for amounts that represent USDC.
- USDC has 6 decimals, so `1 USDC = 1_000_000`.
- Avoid `lamports` in protocol business logic except for rent and transaction fees.

Core principle:

> Users may eventually fund actions from SOL, ETH, or other assets, but protocol accounting settles in USDC.

Token program and mints:

- The program enforces classic SPL Token (`TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA`).
- Token-2022 mints, transfer-fee mints, and bridged USDC variants are rejected at the constraint level.
- The expected USDC mint is stored on `ReputationConfig` so it is verifiable on-chain and configurable per cluster.
- Reference mints:
  - devnet: `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`
  - mainnet-beta: `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`
- Chain context is recorded as CAIP-2 (`solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1` for devnet, `solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp` for mainnet-beta).

Vault custody model:

The v0.2.0 spec must pick exactly one custody pattern per primitive before implementation. Defaults proposed below; revisit in Milestone 1.

- Author bond: per-author PDA-owned token vault (one ATA per author).
- Vouch stake: per-vouch PDA-owned token vault (one ATA per `(voucher, target)`), funded by the voucher who also pays rent and reclaims rent on `revoke_vouch`.
- Listing reward pool: per-listing PDA-owned token vault, separate from the listing PDA's data account.
- Dispute bond: held in the existing config-owned protocol vault until resolution.
- Author payout on purchase: direct transfer to the author's existing USDC ATA, validated against the listing's stored author. The author must maintain the ATA; the program does not auto-create it.
- Voucher revenue claim: transfers from the listing reward vault to the voucher's existing USDC ATA.
- Slashed funds: routed to the dispute resolver / challenger ATA recorded on the dispute, with the protocol treasury vault as a documented fallback.

ATA and rent rules:

- The program never auto-creates a recipient ATA. Clients must ensure ATAs exist before submitting; the web hook layer handles `createAssociatedTokenAccountIdempotentInstruction` in the same transaction.
- SOL is required only for transaction fees and PDA/ATA rent. The party that creates a PDA-owned vault pays its rent (voucher for vouch vault, author for author bond vault, author for listing reward vault). Rent is refunded on the matching close instruction.

## Target Architecture

```text
Buyer / Voucher / Author
        |
        v
Wallet signs USDC transaction
        |
        v
Anchor v0.2.0 USDC program
        |
        +--> validates USDC mint and token accounts
        +--> moves USDC through PDA-owned vaults
        +--> records purchases, vouches, bonds, rewards, disputes
        +--> computes reputation from USDC-backed risk
        |
        v
Web/API indexes v0.2.0 accounts and x402 entitlements
```

## Program Identity And Keypairs

Use a fresh deploy keypair for the USDC-native `v0.2.0` migration.

Recommended naming:

```text
target/deploy/reputation_oracle-keypair.json       # Anchor default for current active local program
target/deploy/reputation_oracle_v01-keypair.json   # archived v0.1.0 SOL devnet program key
target/deploy/reputation_oracle_v02-keypair.json   # fresh v0.2.0 USDC-native devnet program key
```

Version rules:

- Use `v01` and `v02` suffixes for pre-mainnet devnet program keypairs.
- Reserve `v1` / `v1.0.0` language for the first mainnet-ready deployment.
- Do not deploy `v0.2.0` with the existing active `v0.1.0` program ID.

Current note:

- `target/deploy/reputation_oracle-keypair.json` maps to the active `v0.1.0` devnet program.
- `target/deploy/reputation_oracle_v01-keypair.json` is the archived `v0.1.0` keypair copy.
- `target/deploy/reputation_oracle_v02-keypair.json` should be generated fresh when implementation starts.

## Milestones

### Milestone 0: Freeze v0.1.0 Scope

Goal: stop treating the existing SOL program as the future protocol.

Tasks:

- Mark the current program as legacy in docs.
- Keep `v0.1.0` readable while `v0.2.0` is being built.
- Do not add new trust features to `v0.1.0`.
- Decide whether the UI should hide `v0.1.0` write actions immediately or only after `v0.2.0` is usable.

Acceptance criteria:

- `docs/ARCHITECTURE.md` or follow-up docs clearly state that `v0.1.0` is SOL-denominated and legacy.
- New work items target `v0.2.0` unless explicitly marked as `v0.1.0` maintenance.

Verification:

```bash
rg "legacy|USDC-native|SOL-denominated|v0.2.0" docs
```

### Milestone 1: v0.2.0 Protocol Spec

Goal: define the USDC-native account and instruction model before coding.

Tasks:

- Define all `v0.2.0` accounts and PDA seeds.
- Define USDC vault ownership for vouches, author bonds, listing reward pools, and dispute bonds.
- Define whether purchases pay the author directly, through a proceeds vault, or both.
- Define exact reward split, currently expected to remain `60%` author / `40%` voucher pool unless changed.
- Define free listing requirements using `min_author_bond_usdc_micros`.
- Define reputation formula using USDC-backed risk and non-money signals.
- Define dispute liability order:
  - free listings: author bond first
  - paid listings: author bond first, then linked vouchers if needed

Candidate account fields:

- `AgentProfile.total_staked_for_usdc_micros`
- `AgentProfile.author_bond_usdc_micros`
- `Vouch.stake_usdc_micros`
- `Vouch.cumulative_revenue_usdc_micros`
- `AuthorBond.amount_usdc_micros`
- `SkillListing.price_usdc_micros`
- `SkillListing.total_revenue_usdc_micros`
- `SkillListing.unclaimed_voucher_revenue_usdc_micros`
- `Purchase.price_paid_usdc_micros`
- `ReputationConfig.min_stake_usdc_micros`
- `ReputationConfig.dispute_bond_usdc_micros`
- `ReputationConfig.min_author_bond_for_free_listing_usdc_micros`
- `ReputationConfig.usdc_mint`
- `ReputationConfig.token_program`

Floors and calibration to lock in:

- Minimum listing price: replace the v0.1.0 `0.001 SOL` rule with `0.01 USDC` (`10_000` micros) or remove the floor entirely.
- Minimum vouch stake, minimum author bond for free listings, and dispute bond all expressed in micro-USDC.
- Reputation formula: keep the structure (`stake_weight × backed_capital + signals`) but recalibrate `stake_weight` so the unit shift from lamports to micro-USDC does not silently inflate scores by ~1000x. Either (a) normalize stake to whole USDC before weighting, or (b) divide the existing weight by `1_000` and document the new range.
- Cooldowns, dispute holds, and revoke locks carry over from v0.1.0 unchanged; restate them in the spec so they are not dropped during the rewrite.

Events and IDL break:

- Every `emit!` event signature changes (`*_lamports` -> `*_usdc_micros`). List the new event schema in the spec so indexers and downstream consumers can plan.

Acceptance criteria:

- A reviewed spec exists before implementation.
- Every `v0.1.0` lamport business field has an explicit `v0.2.0` replacement or is intentionally removed.
- Token account ownership and mint constraints are specified for every money-moving instruction.

Verification:

```bash
rg "lamports|price_lamports|author_bond_lamports|stake_amount" docs/USDC_NATIVE_MIGRATION.md
```

### Milestone 2: Fresh Program Identity

Goal: create and wire a new devnet program identity for `v0.2.0`.

Tasks:

- Generate `target/deploy/reputation_oracle_v02-keypair.json`.
- Record the new pubkey in the migration notes.
- Update `declare_id!`.
- Update `Anchor.toml` devnet/localnet program IDs.
- Decide whether the crate remains `reputation-oracle` or gets renamed after the `v0.2.0` logic is stable.

Acceptance criteria:

- `solana-keygen pubkey target/deploy/reputation_oracle_v02-keypair.json` returns a new ID distinct from `ELmVnLSNuwNca4PfPqeqNowoUF8aDdtfto3rF9d89wf`.
- `programs/reputation-oracle/src/lib.rs` and `Anchor.toml` agree on the `v0.2.0` program ID.

Verification:

```bash
solana-keygen pubkey target/deploy/reputation_oracle_v02-keypair.json
rg "<new-program-id>" Anchor.toml programs/reputation-oracle/src/lib.rs
```

### Milestone 3: Anchor USDC Rewrite

Goal: replace SOL custody with SPL USDC custody.

Tasks:

- Add `anchor-spl`.
- Use SPL Token account constraints for USDC mint and token accounts.
- Add config-level USDC mint storage.
- Add PDA-owned token vaults where funds must remain under program control.
- Replace `system_program::transfer` business payments with checked token transfers.
- Keep SOL only for rent and transaction fees.
- Remove or rewrite `v0.1.0` migration instructions that only exist for old lamport account layouts.

Instruction areas to rewrite:

- `initialize_config`
- `register_agent`
- `deposit_author_bond`
- `withdraw_author_bond`
- `vouch`
- `revoke_vouch`
- `create_skill_listing`
- `update_skill_listing`
- `purchase_skill`
- `claim_voucher_revenue`
- `open_author_dispute`
- `resolve_author_dispute`
- listing close/remove flows

Acceptance criteria:

- No protocol business amount is named `lamports`.
- All USDC transfers validate:
  - mint
  - source token account owner
  - destination token account owner
  - token account mint
  - PDA authority signer seeds
  - token program
- Program builds with the new ID.

Verification:

```bash
NO_DNA=1 anchor build
cargo check --manifest-path programs/reputation-oracle/Cargo.toml
rg "price_lamports|author_bond_lamports|unclaimed_voucher_revenue|system_program::transfer" programs/reputation-oracle/src
```

### Milestone 4: Program Tests

Goal: prove the USDC accounting works before touching the app.

Tasks:

- Use LiteSVM or Mollusk for fast unit and negative tests on token-account constraints; reserve `anchor test` / Surfpool for end-to-end flows.
- Add tests for config initialization with USDC mint.
- Add tests for agent registration.
- Add tests for author bond deposit/withdraw.
- Add tests for vouch/revoke (including rent refund on revoke).
- Add tests for paid listing purchase and reward pool accounting.
- Add tests for voucher revenue claim.
- Add tests for dispute open/resolve and slashing (slash routed to challenger ATA).
- Add negative tests for: wrong mint, Token-2022 mint, transfer-fee mint, missing recipient ATA, wrong ATA owner, insufficient stake, self-vouch, and reputation overflow.

Acceptance criteria:

- Tests cover every instruction that moves or accounts for USDC.
- Tests assert token balances and account state after each flow.
- Negative tests fail for the intended reason.

Verification:

```bash
NO_DNA=1 anchor test
```

### Milestone 5: IDL And Client Sync

Goal: refresh generated artifacts after the `v0.2.0` program compiles.

Tasks:

- Run `anchor build`.
- Sync the generated IDL to `web/reputation_oracle.json`.
- Regenerate the web client.
- Confirm generated program constants point to the `v0.2.0` program ID.
- Remove stale generated references to lamport-only fields.

Acceptance criteria:

- `web/reputation_oracle.json` has the `v0.2.0` address.
- `web/generated/reputation-oracle` has USDC field names.
- TypeScript compile errors identify all remaining app integration points.

Verification:

```bash
NO_DNA=1 anchor build
cp target/idl/reputation_oracle.json web/reputation_oracle.json
npm --workspace web run generate-client
rg "ELmVnLSN|priceLamports|authorBondLamports|LAMPORTS_PER_SOL" web/generated web/reputation_oracle.json
```

### Milestone 6: Web Hook Integration

Goal: point the app's on-chain write flows at `v0.2.0` USDC instructions.

Tasks:

- Update `web/hooks/useReputationOracle.ts`.
- Replace SOL input conversions with micro-USDC conversions.
- Add USDC ATA discovery/creation requirements where needed.
- Add preflight checks for USDC balance and token accounts.
- Simulate transactions before asking the wallet to sign.
- Keep legacy read paths only if needed for temporary display.

Primary flows:

- register agent
- deposit author bond
- withdraw author bond
- vouch
- revoke vouch
- create/update listing
- purchase skill
- claim voucher revenue
- open/resolve dispute

Acceptance criteria:

- Hook API uses USDC units or clearly named micro-USDC amounts.
- No trust/staking write path calls a SOL-denominated `v0.1.0` instruction.
- Transaction summaries show token, amount, recipient/vault, fee payer, and cluster.

Verification:

```bash
rg "LAMPORTS_PER_SOL|formatSol|priceLamports|authorBondLamports" web/hooks web/lib
npm --workspace web run typecheck
```

### Milestone 7: UI Conversion

Goal: make the product read as USDC-native.

Tasks:

- Update dashboard staking and author bond inputs to USDC.
- Update author pages to show backing, self-stake, revenue, and disputes in USDC.
- Update skill cards and detail pages to treat USDC as primary.
- Remove or hide legacy SOL purchase CTAs.
- Keep primary nav and action sizing consistent with the current UI rules.

Primary files:

- `web/app/dashboard/page.tsx`
- `web/app/author/[pubkey]/page.tsx`
- `web/app/skills/page.tsx`
- `web/app/skills/[id]/page.tsx`
- `web/components/SkillPreviewCard.tsx`
- `web/components/TrustBadge.tsx`

Acceptance criteria:

- User-facing trust capital is displayed in USDC.
- SOL appears only for network fees, legacy notices, or explicit historical context.
- Paid skill purchase copy matches the `v0.2.0` protocol and x402 behavior.

Verification:

```bash
rg "SOL|lamports|formatSol|LAMPORTS_PER_SOL" web/app web/components web/hooks
npm --workspace web run build
```

### Milestone 8: API, x402, And Entitlements Alignment

Goal: align the existing USDC/x402 commerce path with `v0.2.0` protocol semantics.

Tasks:

- Decide whether x402 direct purchases should:
  - continue paying the author directly and only record off-chain entitlement, or
  - settle through `v0.2.0` `purchase_skill` so rewards and on-chain purchase records update.
- Prefer `v0.2.0` on-chain settlement for protocol-visible purchases and voucher rewards.
- Keep `usdc_purchase_receipts` and `usdc_purchase_entitlements` for raw download access.
- Add a `protocol_version` column on `skills`, `usdc_purchase_receipts`, and `usdc_purchase_entitlements` (or equivalent v2 columns) so v0.1.0 and v0.2.0 rows do not collide on `on_chain_address`.
- Mark existing v0.1.0 receipts/entitlements as legacy and stop writing to them from new flows.
- Confirm `buildDownloadRawMessage` format is unchanged so existing CLI agents keep working; only the embedded `listing` value updates.
- Ensure signed download scope handles `v0.2.0` listing addresses.
- Update `/api/x402/supported` to advertise `v0.2.0`.

Acceptance criteria:

- Paid purchases update the same reputation/reward accounting model.
- Raw skill downloads still work for agents using x402.
- No duplicate entitlement path creates inconsistent purchase state.

Verification:

```bash
rg "legacy-sol|purchaseSkill|hasOnChainPurchase|x402-usdc" web/app/api web/lib web/app/skills
npm --workspace web run build
```

### Milestone 9: Docs, CLI, And Skill File

Goal: make public and agent-facing docs match the new protocol.

Tasks:

- Update `docs/ARCHITECTURE.md`.
- Update `docs/program-upgrades-and-redploys.md` or add a `v0.2.0` deploy runbook.
- Update `web/public/skill.md`.
- Update `web/app/docs/page.tsx`.
- Update `packages/agentvouch-cli` for USDC-native publish/list/install flows. CLI keeps read of v0.1.0 listings during the transition but writes only v0.2.0.
- Remove claims that new listings require a SOL minimum price.
- Update `AGENTS.md` learned-facts to reflect USDC-native protocol, new program ID, vault model, and CAIP-2 conventions.
- Co-version the pitch deck `pitch/AgentVouch_walkthrough.pptx` with the new account/instruction counts and currency model.

Acceptance criteria:

- Public docs describe USDC-native trust capital.
- CLI help and examples use USDC.
- Agent-facing install docs still use `https://agentvouch.xyz/skill.md`.

Verification:

```bash
rg "0.001 SOL|price_lamports|lamports|legacy SOL|ELmVnLSN" docs web/public packages/agentvouch-cli web/app/docs
npm --workspace web run build
```

### Milestone 10: Devnet Deploy And Smoke Test

Goal: deploy `v0.2.0` to devnet and verify the full flow.

Tasks:

- Deploy `v0.2.0` to devnet with the fresh keypair.
- Initialize config with devnet USDC mint (`4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`).
- Run a scripted batch re-registration for the internal devnet agents and republish their listings against `v0.2.0`.
- Register test agents.
- Create author bond.
- Create vouch.
- Publish listing.
- Purchase listing.
- Claim voucher revenue.
- Open and resolve a test dispute.
- Confirm reputation score changes (and that the recalibrated scale matches expectations).
- Confirm raw skill download still works for both freshly purchased v0.2.0 entitlements and any preserved legacy entitlements.

Acceptance criteria:

- All core flows pass on devnet.
- Program ID, IDL, generated client, web env, and docs agree.
- No `v0.1.0` SOL write path is needed for the primary product flow.

Verification:

```bash
NO_DNA=1 anchor build
NO_DNA=1 anchor test
npm --workspace web run build
solana program show <v0.2.0-program-id> -u devnet
```

## Security Checklist

Every USDC-moving instruction must validate:

- expected USDC mint
- token account mint
- token account owner
- PDA vault address
- PDA authority seeds
- token program ID
- signer authority
- amount is greater than zero
- arithmetic overflow and underflow
- dispute and withdrawal locks

Every client transaction flow must surface:

- cluster
- token mint
- amount
- source account
- destination account or vault
- fee payer
- expected post-action state

## Branch And Worktree Convention

- Land the rewrite on a dedicated branch (`feat/usdc-native-v0.2.0`) or git worktree, not directly on `main`.
- Keep `main` deploy-safe for the existing `v0.1.0` devnet program until Milestone 10 passes.
- Squash-merge or rebase-merge into `main` only after devnet smoke tests are green and docs/CLI/skill.md are aligned.

## Open Questions And Risk Register

Track decisions that the v0.2.0 spec must close before Milestone 3:

- Vault custody pattern per primitive (per-vouch ATA vs shared vault) — affects rent cost and claim semantics.
- Exact slashing destination policy (challenger ATA vs treasury vault vs split).
- Whether `purchase_skill` pays the author directly or via a proceeds vault with author-signed withdraw — affects the empty-recipient rent failure mode seen on v0.1.0.
- Whether to keep `init_if_needed` for any program-side ATA creation, or push all ATA creation to clients.
- Reputation `stake_weight` recalibration value and resulting score range.
- Minimum listing price floor (`0.01 USDC` vs no floor).
- Whether x402 direct purchases settle on-chain through `purchase_skill` or remain off-chain entitlement only.
- DB migration shape: `protocol_version` column vs parallel `*_v2` tables.

## Non-Goals

The USDC-native `v0.2.0` program should not:

- support arbitrary collateral assets in the core program
- add a price-feed oracle
- preserve `v0.1.0` account layouts
- preserve `v0.1.0` purchase PDAs
- keep SOL-denominated reputation inputs
- support bridged USDC variants as protocol collateral

## Definition Of Done

The migration is complete when:

- `v0.2.0` is deployed to devnet with a fresh program ID.
- Every protocol money field is USDC-denominated; `rg "lamports|price_lamports|author_bond_lamports|stake_amount" programs/reputation-oracle/src` returns no business-logic hits (rent helpers excluded).
- `rg "LAMPORTS_PER_SOL|formatSol|priceLamports|authorBondLamports" web/app web/components web/hooks` returns no hits outside legacy notices.
- Every USDC-moving instruction has at least one positive and one negative test (wrong mint, Token-2022, missing ATA, wrong owner).
- Vouching, author bonds, purchases, voucher rewards, disputes, and reputation all use USDC accounting.
- Web primary flows no longer require `v0.1.0` SOL instructions.
- x402 paid downloads still work for v0.2.0 entitlements.
- `web/public/skill.md`, `docs/ARCHITECTURE.md`, `AGENTS.md`, and `pitch/AgentVouch_walkthrough.pptx` describe the live USDC-native protocol.
- `NO_DNA=1 anchor build`, program tests, and `npm --workspace web run build` pass.
