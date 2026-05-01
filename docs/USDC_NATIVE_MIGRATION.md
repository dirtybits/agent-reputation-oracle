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

Governance decision:

- Devnet `v0.2.0` may use a controlled deployer key for iteration.
- Mainnet `v1.0.0` must not launch with a single hot-wallet upgrade authority.
- Mainnet upgrade authority, config authority, treasury authority, and settlement authority rotation must be controlled by a multisig or stronger governance setup before real user funds are accepted.
- Governance-sensitive changes include `usdc_mint`, `token_program`, `protocol_treasury_vault`, `x402_settlement_authority`, `x402_settlement_vault`, economic floors, slash percentages, and any future protocol fee.
- `v0.2.0` charges no protocol fee. The split remains `60%` author / `40%` voucher pool, but account layouts should leave room for an explicitly configured future protocol fee without changing historical accounting.

Interop decision:

- Use CAIP-2 as the canonical chain identifier across docs, schema, events, and indexer outputs (`solana:<genesis>` today; `eip155:<chain-id>` and other CAIP-2 strings for future deployments).
- Align with ERC-8004 Trustless Agents and the Solana Agent Registry. AgentVouch is the slashing/economics layer on top of those identity and reputation registries, not a replacement for them.
- v0.2.0 does not require an ERC-8004 binding, but accounts and events leave room for `agent_registry`, `agent_id`, and `agent_uri`-style linkage so reputation deltas can be published back to ERC-8004 / Solana Agent Registry surfaces.
- Cross-chain redeployments inherit the same protocol semantics; only the chain context (CAIP-2), USDC mint, and token program change.

Non-goals for v0.2.0:

- AgentVouch does not introduce a new agent identity primitive. It links to ERC-8004 / Solana Agent Registry instead.
- AgentVouch does not implement cross-chain reputation aggregation in v0.2.0; it only emits chain-tagged, registry-mappable events that a future indexer or bridge can aggregate.

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
- Token-2022 token accounts and bridged USDC variants are rejected at the constraint level because the protocol only accepts the configured native Circle USDC mint under the classic SPL Token program.
- The expected USDC mint is stored on `ReputationConfig` so it is verifiable on-chain and configurable per cluster.
- Reference mints:
  - devnet: `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`
  - mainnet-beta: `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`
- Chain context is recorded as CAIP-2 (`solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1` for devnet, `solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp` for mainnet-beta).

USDC risk acknowledgement:

- Native Circle USDC is centralized collateral. Circle can blacklist/freeze accounts, mint/burn policy is issuer-controlled, and access depends on regulated infrastructure.
- `v0.2.0` accepts that risk because USDC gives the protocol a stable unit of account, simple listing prices, legible slashable backing, and a better fit for x402 and agentic commerce than volatile SOL or multi-asset collateral.
- The protocol should not describe USDC as decentralization-maximal collateral. It is the pragmatic settlement asset for this phase.
- Keep the asset choice explicit in config through `usdc_mint` and `token_program`, but enforce only native Circle USDC under the classic SPL Token program in `v0.2.0`.
- If a credible decentralized stable asset emerges with enough liquidity, chain support, x402 support, and operational simplicity, evaluate it in a future protocol version. Do not add price oracles or multi-collateral support in `v0.2.0`.

Identity and reputation interop:

- Treat AgentVouch as the economic accountability layer that sits on top of agent identity, not a competing identity standard.
- Align with ERC-8004 Trustless Agents (Identity, Reputation, Validation registries) and the Solana Agent Registry, which is interoperable with ERC-8004.
- The protocol owns vouches, author bonds, listings, purchases, voucher rewards, and disputes in USDC. Identity and base reputation feed in from registries; AgentVouch contributes the economic, slashable side of trust.
- Every protocol object (`AgentProfile`, `SkillListing`, `Vouch`, `AuthorBond`, `Purchase`, dispute accounts) and every event must carry enough fields to be mapped to its ERC-8004 equivalent (agent id, feedback id, validation id) and to a CAIP-2 chain context (`solana:<genesis>` today, `eip155:<chain-id>` later).
- Where an `AgentProfile` corresponds to a registered agent, store enough registry linkage (`agent_registry`, `agent_id`, and/or `agent_uri`) alongside the protocol pubkey so AgentVouch reputation can be read back through ERC-8004 and the Solana Agent Registry.
- Future deployments on EVM or stablecoin-native chains should reuse ERC-8004 identity/reputation surfaces directly rather than introducing a second identity primitive. AgentVouch contributes slashing and bond economics on whichever chain it is deployed.

Vault custody model:

The v0.2.0 program uses one explicit custody pattern per primitive:

- Author bond: per-author PDA-owned token vault.
- Vouch stake: per-vouch PDA-owned token vault, funded by the voucher who also pays rent and reclaims rent on `revoke_vouch`.
- Listing reward pool: per-listing PDA-owned token vault, separate from the listing PDA's data account.
- Dispute bond: per-dispute PDA-owned token vault until resolution.
- Author payout on purchase: direct transfer to the author's canonical USDC ATA for `(author, config.usdc_mint)`.
- Voucher revenue claim: transfers from the listing reward vault to the voucher's canonical USDC ATA.
- Slashed funds: preserve v0.1.0 economics in USDC. If a dispute is upheld, the challenger receives their dispute bond plus slashed author/voucher funds. If dismissed, the challenger bond goes to the protocol treasury vault.

ATA and rent rules:

- The program never auto-creates a recipient ATA. Clients must ensure ATAs exist before submitting; the web hook layer handles `createAssociatedTokenAccountIdempotentInstruction` in the same transaction.
- Listing and purchase clients must create the author's canonical USDC ATA idempotently when needed. v0.2.0 does not support arbitrary author payout wallets.
- SOL is required only for transaction fees and PDA/ATA rent. The party that creates a PDA-owned vault pays its rent (voucher for vouch vault, author for author bond vault, author for listing reward vault, challenger for dispute vault). Rent is refunded on the matching close instruction.

Vault lifecycle rules:

- Author bond vaults can close only after the author bond balance is zero and the author has no open disputes.
- Vouch stake vaults can close only through `revoke_vouch` or final settlement after the vouch is no longer active and no linked dispute can slash it.
- If a vouch is fully slashed, slashed USDC goes to the dispute payout path, but rent from closing the vouch PDA/token vault returns to the original rent payer unless the spec explicitly defines a punitive rent forfeiture. The default is no rent forfeiture.
- Listing reward vaults cannot close while `unclaimed_voucher_revenue_usdc_micros > 0` or while any voucher has claimable rewards. Listing removal should freeze new purchases but keep the reward vault claimable until a permissionless claim/sweep path empties it.
- Dispute bond vaults close on dispute resolution. If upheld, the challenger receives their dispute bond plus slashed USDC. If dismissed, the challenger bond goes to the protocol treasury vault. Rent returns to the original dispute vault rent payer unless the spec explicitly changes this.
- `withdraw_author_bond` and `revoke_vouch` must fail while the target author has active disputes that can reach those funds.
- If an author loses their wallet, v0.2.0 does not provide admin recovery by default. Funds remain controlled by the original author authority unless a later governance-approved migration instruction is specified.

Purchase settlement principle:

- Protocol-visible paid purchases must preserve the `60%` author / `40%` voucher split.
- Direct app purchases call `purchase_skill` and split USDC inside the Anchor program.
- x402 purchases for protocol-listed paid skills must not bypass voucher rewards. The intended v0.2.0 path is a POC-gated settlement bridge: x402 pays a protocol settlement vault, the backend verifies the settled transaction and memo, then a configured `settlement_authority` calls `settle_x402_purchase` to create the on-chain purchase and split funds.
- If the bridge POC fails, x402 remains limited to repo-only/off-chain entitlement flows until a trustless custom x402 scheme or facilitator extension can call the protocol directly.

x402 bridge POC pass/fail criteria:

- Pass requires proof that `@x402/svm` and the selected facilitator can settle an exact USDC transfer into the intended protocol settlement vault pattern, including the PDA/off-curve owner case if that is the selected design.
- Pass requires deterministic memo binding to `protocol_version`, chain context, listing address, skill database id, buyer, and nonce without storing PII or free-form user text on-chain.
- Pass requires reliable buyer extraction (`settle.payer` or transaction authority) so the on-chain `Purchase` PDA is derived from the paying wallet, not the facilitator fee payer.
- Pass requires idempotency: the same payment reference or transaction signature cannot create more than one `X402SettlementReceipt`, `Purchase`, entitlement, or reward split.
- Pass requires a retry/refund path for the case where x402 settles but `settle_x402_purchase` fails after USDC lands in the settlement vault.
- Fail means protocol-listed paid skills require direct `purchase_skill`; `/api/x402/supported` must advertise only repo-only/off-chain x402 support and return capability metadata explaining that protocol-listed paid skills require direct on-chain purchase.
- Allowed x402 flows after bridge failure are: free downloads, existing legacy entitlements, and repo-only/off-chain paid skills that are explicitly marked as not protocol-visible.

Settlement authority constraints:

- `settlement_authority` can only settle verified x402 payments from the settlement vault into the normal purchase/reward accounting path.
- It cannot set listing price, change author, change voucher split, mint USDC, bypass `Purchase` PDA uniqueness, or withdraw arbitrary settlement vault balances.
- It must be rotatable and pausable by config authority, with every settlement emitting a versioned event for audit.
- Production use requires monitoring for settlement failures, stuck settlement vault balances, duplicate attempts, and authority rotation events.

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
target/deploy/reputation_oracle-keypair.json       # legacy Anchor default for current v0.1.0 local program
target/deploy/reputation_oracle_v01-keypair.json   # archived v0.1.0 SOL devnet program key
target/deploy/agentvouch-keypair.json              # Anchor default for v0.2.0 USDC-native program
target/deploy/agentvouch_v02-keypair.json          # archived v0.2.0 keypair copy
```

Version rules:

- Use `v01` and `v02` suffixes for pre-mainnet devnet program keypairs.
- Reserve `v1` / `v1.0.0` language for the first mainnet-ready deployment.
- Do not deploy `v0.2.0` with the existing active `v0.1.0` program ID.

Current note:

- `target/deploy/reputation_oracle-keypair.json` maps to the active `v0.1.0` devnet program.
- `target/deploy/reputation_oracle_v01-keypair.json` is the archived `v0.1.0` keypair copy.
- `target/deploy/agentvouch-keypair.json` was generated for the fresh `v0.2.0` program identity.
- `target/deploy/agentvouch_v02-keypair.json` is the archived `v0.2.0` keypair copy.
- `v0.2.0` program pubkey: `CVpe18yvJ4nJxHivqu8G85TSKn8YVZcWaVE3z8afrQnW`.

## Planned Implementation Process

Treat `v0.2.0` as a fresh protocol that uses the existing codebase as scaffolding, not as a backwards-compatible patch set. There is no real usage or user money on the current devnet deployment, so the implementation should prefer a clean USDC-native model over compatibility shims.

Recommended cadence:

- Use a dedicated branch or worktree and keep `main` deploy-safe for the current `v0.1.0` devnet app until the `v0.2.0` smoke test passes.
- Do one broad on-chain pass after the Pre-Milestone 3 gates close: rewrite accounts, fields, PDA seeds, token constraints, vault movement, and instruction signatures together so the IDL moves as one coherent protocol.
- Do not migrate one instruction at a time while preserving SOL account layouts. That creates temporary compatibility layers that should not survive into the fresh program.
- After the broad on-chain pass, iterate in tight compile/test loops: `anchor build`, IDL/client sync, unit tests, negative tests, and compute/account measurement.
- Once the program and IDL are stable, integrate outward in layers: generated client, web hooks, API/indexing, x402 bridge path, UI copy, CLI, docs, and pitch deck.
- Keep commits reviewable by milestone or subsystem, but do not require each commit to preserve a fully working hybrid SOL/USDC product. The branch only needs to become product-complete before devnet cutover.

Rule of thumb:

- Use broad rewrite passes for protocol shape and account layout decisions.
- Use incremental passes for verification, UI/API integration, docs, and bug fixes after the core shape compiles.
- If an implementation starts accumulating compatibility code for `v0.1.0`, stop and replace it with the simpler `v0.2.0` design unless it is explicitly needed for temporary read-only display.

Planning structure:

- Keep this document as the stable source-of-truth spec and roadmap. Do not turn it into a live task tracker.
- Use separate milestone plans when execution starts. Each milestone plan should contain implementation steps, working TODOs, verification commands, blockers, and notes.
- Update this document only when a decision changes protocol design, durable process, acceptance criteria, or a pre-Milestone gate.
- Close TODOs in the milestone plan as work progresses; do not mirror every execution TODO back into this document.

Example milestone plans:

- `Milestone 1 - Protocol Spec`
- `Milestone 2 - Fresh Program Identity`
- `Milestone 3 - Anchor USDC Rewrite`
- `Milestone 4 - Program Tests`

## Milestones

### Milestone 0: Freeze v0.1.0 Scope

Goal: stop treating the existing SOL program as the future protocol.

Tasks:

- Mark the current program as legacy in docs.
- Keep `v0.1.0` readable while `v0.2.0` is being built.
- Do not add new trust features to `v0.1.0`.
- Rewrite `AGENTS.md` learned workspace facts for the target USDC-native design before implementation starts, so agent guidance does not keep steering work back to legacy SOL-denominated patterns.
- Decide whether the UI should hide `v0.1.0` write actions immediately or only after `v0.2.0` is usable.

Acceptance criteria:

- `docs/ARCHITECTURE.md` or follow-up docs clearly state that `v0.1.0` is SOL-denominated and legacy.
- `AGENTS.md` reflects the target `v0.2.0` USDC-native protocol, fresh program ID plan, per-primitive vault model, CAIP-2 conventions, and x402 bridge gating.
- New work items target `v0.2.0` unless explicitly marked as `v0.1.0` maintenance.

Verification:

```bash
rg "legacy|USDC-native|SOL-denominated|v0.2.0" docs
rg "USDC-native|v0.2.0|per-primitive|CAIP-2|x402 bridge" AGENTS.md
```

### Milestone 1: v0.2.0 Protocol Spec

Goal: define the USDC-native account and instruction model before coding.

Tasks:

- Define all `v0.2.0` accounts and PDA seeds.
- Define USDC vault ownership for vouches, author bonds, listing reward pools, and dispute bonds.
- Define canonical USDC ATA validation for direct author payouts.
- Define x402 settlement vault ownership and the `settlement_authority` role for the bridge POC.
- Define exact reward split, currently expected to remain `60%` author / `40%` voucher pool unless changed.
- Define free listing requirements using `min_author_bond_usdc_micros`.
- Define reputation formula using USDC-backed risk and non-money signals.
- Define dispute liability order:
  - free listings: author bond first
  - paid listings: author bond first, then linked vouchers if needed
- Preserve v0.1.0 dispute payout policy in USDC:
  - upheld: challenger receives their dispute bond plus slashed funds
  - dismissed: challenger bond goes to protocol treasury
- Define upgrade authority, config authority, settlement authority, treasury authority, pause/rotation flow, and mainnet multisig requirements.
- Define treasury withdrawal policy and confirm `v0.2.0` has zero protocol fee.
- Define voucher reward accounting model and revenue eligibility rules before coding.
- Define author wallet rotation policy. Default: listings are bound to the original author authority and canonical USDC ATA unless a future author-signed migration instruction is specified.
- Define how free listings behave if `author_bond_usdc_micros` drops below `min_author_bond_for_free_listing_usdc_micros` after slash or withdrawal. Default: freeze new paid/free installs that require trust until the bond is restored or the listing is explicitly marked inactive.
- Define dispute evidence semantics. Default: evidence URI and resolver/reviewer roles remain unchanged from v0.1.0 unless the spec explicitly changes them.
- Define ERC-8004 / Solana Agent Registry interop fields:
  - Optional `AgentProfile.agent_registry` plus `AgentProfile.agent_id` (or one opaque `registry_ref` if layout pressure matters) that links the on-chain profile to the registered agent in the Solana Agent Registry.
  - Optional `AgentProfile.agent_uri` when the implementation needs to resolve the external registration file directly.
  - Optional listing-level mirror of the same linkage for cross-chain reputation portability.
  - Event payloads include `protocol_version`, CAIP-2 chain context, program id, and registry linkage fields where present, so indexers can publish reputation deltas back to ERC-8004-aligned surfaces.
- Treat AgentVouch as a reputation-emitter into ERC-8004 / Solana Agent Registry, not an alternative identity layer. Avoid baking a competing identity primitive into v0.2.0 accounts.

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
- `ReputationConfig.protocol_treasury_vault`
- `ReputationConfig.x402_settlement_authority`
- `ReputationConfig.x402_settlement_vault`
- Optional `AgentProfile.agent_registry` for ERC-8004 / Solana Agent Registry linkage.
- Optional `AgentProfile.agent_id` for the registry-local agent identifier.
- Optional `AgentProfile.agent_uri` for the external registration file when needed.
- Optional `SkillListing.agent_registry` mirror for cross-chain reputation portability.
- Optional `SkillListing.agent_id` mirror for cross-chain reputation portability.

Floors and calibration to lock in:

- Minimum listing price: replace the v0.1.0 `0.001 SOL` rule with `0.01 USDC` (`10_000` micros) or remove the floor entirely.
- Minimum vouch stake, minimum author bond for free listings, and dispute bond all expressed in micro-USDC.
- Reputation formula: retune around USD economic value, not only the decimal shift from lamports to micro-USDC. Calibrate against the legacy v0.1.0 low-end trust scale (anchored to the `0.001 SOL` listing floor), not accidental lamport math. Lock exact score ranges, weights, caps, rounding behavior, and overflow limits before implementation.
- Cooldowns, dispute holds, and revoke locks carry over from v0.1.0 unchanged; restate them in the spec so they are not dropped during the rewrite.

Voucher reward accounting to lock in:

- Use an explicit cumulative reward index or equivalent per-vouch accounting model so late vouches do not earn prior revenue.
- A voucher keeps already-accrued claim rights after revoke or partial slash unless the spec explicitly defines forfeiture; default forfeiture is only forward-looking after the vouch is inactive or stake is reduced.
- Partial slashes reduce future reward weight in proportion to remaining active stake.
- Listing closure cannot strand unclaimed rewards. Either all claimable rewards must be claimed first, or a permissionless sweep/force-claim flow must preserve voucher ownership.

Events and IDL break:

- Every `emit!` event signature changes (`*_lamports` -> `*_usdc_micros`). List the new event schema in the spec so indexers and downstream consumers can plan.
- Every v0.2.0 event should include `protocol_version` and enough keys for indexers to derive chain context, program id, listing, buyer/voucher/author, and affected vaults.
- Reputation-relevant events (vouch, revoke, slash, dispute resolved, author bond change, purchase, voucher claim) should be shaped so an ERC-8004-aligned bridge can map them to Reputation Registry feedback or Validation Registry results without parsing free-form text.

Acceptance criteria:

- A reviewed spec exists before implementation.
- Every `v0.1.0` lamport business field has an explicit `v0.2.0` replacement or is intentionally removed.
- Token account ownership and mint constraints are specified for every money-moving instruction.
- Protocol-listed paid purchase paths preserve the author/voucher split.
- Economic floors, reputation ranges, reward-index math, freeze rules, treasury policy, and authority rotation rules are decided before Milestone 3 starts.

Verification:

```bash
rg "lamports|price_lamports|author_bond_lamports|stake_amount" docs/USDC_NATIVE_MIGRATION.md
```

### Milestone 2: Fresh Program Identity

Goal: create and wire a new devnet program identity for `v0.2.0`.

Tasks:

- Generate `target/deploy/agentvouch-keypair.json` and mirror a versioned `target/deploy/agentvouch_v02-keypair.json` copy.
- Record the new pubkey in the migration notes.
- Update `declare_id!`.
- Update `Anchor.toml` devnet/localnet program IDs.
- Rename the crate/lib from `reputation-oracle` / `reputation_oracle` to `agentvouch`.
- Rename the Anchor program identity to `agentvouch`, including the crate/lib name and `programs/agentvouch/` folder.
- Move the checked-in web IDL/client paths to `web/agentvouch.json` and `web/generated/agentvouch`.

Acceptance criteria:

- `solana-keygen pubkey target/deploy/agentvouch-keypair.json` returns `CVpe18yvJ4nJxHivqu8G85TSKn8YVZcWaVE3z8afrQnW`, distinct from the legacy `v0.1.0` program ID.
- `programs/agentvouch/src/lib.rs` and `Anchor.toml` agree on the `v0.2.0` program ID.

Verification:

```bash
solana-keygen pubkey target/deploy/agentvouch-keypair.json
rg "CVpe18yvJ4nJxHivqu8G85TSKn8YVZcWaVE3z8afrQnW" Anchor.toml programs/agentvouch/src/lib.rs
```

### Pre-Milestone 3 Gates

Goal: resolve design questions that would be expensive to rewrite after the Anchor USDC implementation starts.

Required gates:

- x402 bridge POC pass/fail decision, including PDA settlement vault compatibility, memo binding, payer extraction, idempotency, retry, and refund behavior.
- Governance and authority model for devnet and mainnet, including upgrade authority custody and config authority rotation.
- Treasury policy, including who can withdraw treasury USDC, under what approval threshold, and whether withdrawals are disabled on devnet/mainnet.
- Exact economic floors (provisional values to lock in before coding):
  - Minimum listing price: 0.01 USDC (`10_000` micros).
  - Minimum author bond for free listings and minimum vouch stake: 1 USDC.
  - Dispute bond: 0.5 USDC.
- Reputation score formula, score caps, rounding behavior, and USD-value calibration against the legacy v0.1.0 low-end trust scale (anchored to the `0.001 SOL` listing floor).
- Voucher reward index model, revoke/slash eligibility rules, and listing close behavior with unclaimed rewards.
- Compute/account ceiling review for every instruction, especially disputes that pass linked vouches and token accounts through `remaining_accounts`.
- Toolchain pin: Anchor version, Solana CLI version, Rust/MSRV, `anchor-spl` version, and generated client command.

Acceptance criteria:

- No item above remains in the risk register as an unresolved implementation fork.
- Milestone 3 can proceed without adding placeholder shims or compatibility layers for undecided economics.

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
- Add post-transfer balance or state checks anywhere instruction logic depends on vault deltas.
- Keep compute and account-count budgets visible in tests for high-account flows.
- After every `anchor build` (or `anchor clean && anchor build` when IDLs look stale), copy `target/idl/agentvouch.json` -> `web/agentvouch.json` and run `web/scripts/generate-client.ts`. The web client must remain Vercel-deploy-safe.

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
- `settle_x402_purchase` after the bridge POC passes
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
- No instruction requires an unbounded number of accounts. If dispute resolution can exceed account limits for highly vouched authors, the spec must define batching or capped linked-vouch processing.

Verification:

```bash
NO_DNA=1 anchor build
cargo check --manifest-path programs/agentvouch/Cargo.toml
rg "price_lamports|author_bond_lamports|unclaimed_voucher_revenue|system_program::transfer" programs/agentvouch/src
```

### Milestone 4: Program Tests

Goal: prove the USDC accounting works before touching the app.

Testing strategy:

- Use LiteSVM for fast unit tests of token transfers, vault accounting, reputation math, and edge cases (wrong mint, missing ATA, insufficient balance, active-dispute freezes).
- Use Surfpool or devnet for integration tests that need RPC fidelity or live-cluster behavior. If a local validator is used, clone/import the required USDC mint and token accounts rather than assuming the real devnet mint exists locally.
- Measure compute units and account counts on worst-case dispute paths (highly-vouched author) before devnet cutover.

Tasks:

- Use LiteSVM or Mollusk for fast unit and negative tests on token-account constraints; reserve `anchor test` / Surfpool for end-to-end flows.
- Add tests for config initialization with USDC mint.
- Add tests for agent registration.
- Add tests for author bond deposit/withdraw.
- Add tests for vouch/revoke (including rent refund on revoke).
- Add tests for paid listing purchase and reward pool accounting.
- Add tests that author proceeds are paid directly to the canonical author USDC ATA.
- Add tests for voucher revenue claim.
- Add tests for dispute open/resolve and slashing (slash routed to challenger ATA).
- Add bridge POC tests before implementing `settle_x402_purchase`: x402 exact payment to protocol settlement vault, memo binding, payer extraction, duplicate payment ref rejection, and retry/refund behavior.
- Add negative tests for: wrong mint, wrong token program, missing recipient ATA, wrong ATA owner, insufficient stake, self-vouch, and reputation overflow.

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
- Sync the generated IDL to `web/agentvouch.json`.
- Regenerate the web client.
- Confirm generated program constants point to the `v0.2.0` program ID.
- Remove stale generated references to lamport-only fields.

Acceptance criteria:

- `web/agentvouch.json` has the `v0.2.0` address.
- `web/generated/agentvouch` has USDC field names.
- TypeScript compile errors identify all remaining app integration points.

Verification:

```bash
NO_DNA=1 anchor build
cp target/idl/agentvouch.json web/agentvouch.json
npm --workspace web run generate-client
rg "ELmVnLSN|priceLamports|authorBondLamports|LAMPORTS_PER_SOL" web/generated web/agentvouch.json
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

- Treat direct `purchase_skill` as the canonical protocol-visible paid purchase path.
- Require every protocol-listed paid purchase path to preserve the `60%` author / `40%` voucher split.
- Run the x402 settlement bridge POC before making x402 primary for protocol-listed paid skills:
  - x402 exact payment credits a protocol settlement vault
  - `extra.memo` binds payment to skill, listing, chain context, and nonce
  - server verifies settled token delta, memo, payer, mint, and amount
  - backend calls `settle_x402_purchase` as `settlement_authority`
  - program creates an idempotent `X402SettlementReceipt` PDA and the normal `Purchase` PDA
  - program splits USDC from the settlement vault to author ATA and listing reward vault
- Browser USDC x402 uses split-signature sponsored flow; gate it to wallets that support `partialSign` (route Phantom embedded/send-only wallets to direct `signAndSendTransaction` or agent fallback). Document this for the settlement bridge POC.
- If the bridge POC fails, disable x402 for protocol-listed paid skills and require direct `purchase_skill`; keep x402 only for repo-only/off-chain entitlement flows.
- Keep `usdc_purchase_receipts` and `usdc_purchase_entitlements` for raw download access.
- Add active protocol metadata to `skills`:
  - `on_chain_protocol_version`
  - `on_chain_program_id`
- Add a unique index on `(chain_context, on_chain_program_id, on_chain_address)` where `on_chain_address IS NOT NULL`.
- v0.2.0 republish updates the existing `skills.id` row rather than creating a second skill row, so existing installs, versions, and entitlements remain attached to the same database skill.
- Keep entitlement identity as `(skill_db_id, buyer_pubkey)` so download access survives v0.1.0 to v0.2.0 republish.
- Add receipt audit fields such as `payment_flow` and nullable `protocol_version`; keep `payment_tx_signature` globally unique.
- Mark existing v0.1.0 receipts as legacy and stop writing legacy receipt shapes from new flows.
- Add a direct-purchase indexing path for raw download entitlement:
  - Browser purchase flow submits the confirmed `purchase_skill` signature to an API endpoint.
  - The API verifies the transaction, event, buyer, listing, price, mint, program id, and chain context before writing receipt/entitlement rows.
  - A background reconciler or webhook backfills missed direct purchases from v0.2.0 events so DB state does not rely solely on client reporting.
- Confirm `buildDownloadRawMessage` format is unchanged so existing CLI agents keep working; only the embedded `listing` value updates.
- Confirm `Purchase` PDA derivation seeds and signed-download semantics are stable across the program-id change, with CLI updates limited to the generated client/program id unless the spec intentionally changes seeds.
- Ensure signed download scope handles `v0.2.0` listing addresses.
- Update `/api/x402/supported` to advertise the v0.2.0 bridge only after the POC passes; otherwise document that protocol-listed paid skills require direct `purchase_skill`.
- Add observability for indexing lag, failed entitlement writes, stuck x402 settlement vault funds, direct-purchase verification failures, and config/authority rotation events.

Acceptance criteria:

- Protocol-listed paid purchases update the same reputation/reward accounting model.
- Raw skill downloads still work for agents using allowed x402 flows.
- No duplicate entitlement path creates inconsistent purchase state.
- Direct on-chain purchases grant download access after API verification, and background reconciliation can repair missed client callbacks.

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
- Document the first-time author cost shift: USDC author bond plus SOL for rent/fees/ATA creation, even though protocol accounting is USDC-native.
- Document that x402 bridge memos must contain only protocol references (version, listing, skill id, nonce) and no PII or free-form buyer text.
- Update `AGENTS.md` learned-facts to reflect USDC-native protocol, new program ID, vault model, and CAIP-2 conventions.
- Co-version the pitch deck `pitch/AgentVouch_walkthrough.pptx` (and its paper sibling) with the new account/instruction counts, vault-per-primitive model, and USDC-native architecture slide. The deck pulls facts directly from the program; keep it in sync.
- After every `anchor build`, copy `target/idl/agentvouch.json` to `web/agentvouch.json` and rerun `web/scripts/generate-client.ts` so the web client stays deploy-safe.

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
- Enable the v0.2.0 app path behind a feature flag while v0.1.0 remains readable.
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
- Confirm `/api/skills` and trust pages can dual-read v0.1.0 legacy data and v0.2.0 primary data during the cutover.
- Hard-cut write actions to v0.2.0 only after direct purchase indexing, entitlement repair, and smoke tests pass.

Acceptance criteria:

- All core flows pass on devnet.
- Program ID, IDL, generated client, web env, and docs agree.
- No `v0.1.0` SOL write path is needed for the primary product flow.
- Feature flag, dual-read fallback, and hard-cut criteria are documented before app traffic moves to v0.2.0.

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
- x402 settlement authority, memo binding, payment-ref uniqueness, and settlement vault balance before any bridge settlement
- post-transfer vault/account state when instruction logic depends on token deltas
- no PII or free-form buyer content in emitted events or on-chain x402 memos

Every client transaction flow must surface:

- cluster
- token mint
- amount
- source account
- destination account or vault
- fee payer
- expected post-action state

Spam and abuse checks:

- Minimum stake, dispute bond, and listing author-bond floors should be high enough to make vouch spam, listing spam, and frivolous disputes uneconomic.
- Any rate limit in the web/API layer is a supplement only. The on-chain protocol must rely on economic costs and account constraints, not hidden centralized throttles.
- Compute and account-count ceilings should be measured for worst-case dispute and voucher-claim flows before devnet cutover.

## Branch And Worktree Convention

- Land the rewrite on a dedicated branch (`feat/usdc-native-v0.2.0`) or git worktree, not directly on `main`.
- Keep `main` deploy-safe for the existing `v0.1.0` devnet program until Milestone 10 passes.
- Squash-merge or rebase-merge into `main` only after devnet smoke tests are green and docs/CLI/skill.md are aligned.

## Open Questions And Risk Register

Track decisions that the v0.2.0 spec must close before Milestone 3:

- Exact x402 bridge POC outcome and whether x402 can be primary for protocol-listed paid skills in v0.2.0.
- Whether the x402 settlement vault can safely use a PDA owner with the current facilitator implementation.
- Whether `settle.payer` from the x402 facilitator is reliable enough to derive the on-chain `Purchase` PDA buyer.
- Retry and refund policy when x402 settles but `settle_x402_purchase` fails.
- Reputation `stake_weight` recalibration value and resulting score range.
- Minimum listing price floor (`0.01 USDC` vs no floor).
- Exact DB migration shape for active protocol metadata and receipt audit fields.
- Upgrade authority custody, config authority rotation, and pause policy.
- Treasury withdrawal policy and whether any treasury withdrawals are allowed before mainnet governance exists.
- Author wallet rotation/dead-author policy.
- Rent routing during slashing and force-close flows.
- Listing removal behavior when voucher rewards remain unclaimed.
- Direct purchase indexing reliability and backfill source.
- Exact ERC-8004 / Solana Agent Registry binding shape: which fields the protocol stores on-chain (`agent_registry`, `agent_id`, `agent_uri`, or opaque `registry_ref`) and which it derives off-chain at the indexer layer.

## v1.0.0 Mainnet Readiness

The `v0.2.0` devnet migration is not mainnet-ready until these are complete:

- External or senior internal security review of all USDC-moving instructions, authority controls, and dispute/slashing paths.
- Mainnet upgrade authority controlled by multisig or stronger governance; no single hot wallet controls upgrades or config.
- Mainnet config runbook for native USDC mint, token program, treasury vault, settlement authority, economic floors, and slash percentage.
- Treasury policy documented, including withdrawal authority, approval threshold, accounting, and public reporting expectations.
- Incident response runbook for stuck settlement vault funds, bad config, compromised authority, failed indexer, and erroneous dispute resolution.
- Monitoring for program events, vault balances, indexing lag, x402 settlement failures, authority rotations, and unexpected treasury movement.
- Mainnet launch checklist that confirms `web/public/skill.md`, docs, CLI, generated client, IDL, pitch deck, and Vercel env all reference the same program/config.
- Decision on whether upgrade authority remains active, is time-locked, or is eventually frozen after sufficient production hardening.

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
- Every protocol money field is USDC-denominated; `rg "lamports|price_lamports|author_bond_lamports|stake_amount" programs/agentvouch/src` returns no business-logic hits (rent helpers excluded).
- `rg "LAMPORTS_PER_SOL|formatSol|priceLamports|authorBondLamports" web/app web/components web/hooks` returns no hits outside legacy notices.
- After `anchor build`, `web/agentvouch.json` and generated client artifacts are synced to the live `v0.2.0` IDL.
- Every USDC-moving instruction has at least one positive and one negative test (wrong mint, wrong token program, missing ATA, wrong owner).
- Vouching, author bonds, purchases, voucher rewards, disputes, and reputation all use USDC accounting.
- Web primary flows no longer require `v0.1.0` SOL instructions.
- Protocol-listed paid purchases preserve the `60%` author / `40%` voucher split. If the x402 bridge POC passes, x402 purchases do this through `settle_x402_purchase`; if it fails, x402 is disabled for protocol-listed paid skills until a later bridge or custom scheme ships.
- x402 paid downloads still work for allowed v0.2.0 entitlement flows.
- Direct on-chain purchases are indexed into download entitlements through verified API submission plus reconciliation.
- Active-dispute freeze invariants, vault close/refund rules, reward-index math, and listing-removal behavior are covered by tests.
- Governance, treasury, authority rotation, pause, and mainnet readiness policies are documented even if `v0.2.0` remains devnet-only.
- `web/public/skill.md`, `docs/ARCHITECTURE.md`, `AGENTS.md`, and `pitch/AgentVouch_walkthrough.pptx` describe the live USDC-native protocol.
- `NO_DNA=1 anchor build`, program tests, and `npm --workspace web run build` pass.

