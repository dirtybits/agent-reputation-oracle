---
name: reputation oracle redeploy
overview: Upgrade the existing `reputation_oracle` program on devnet with the same program ID so the new minimum listing price is enforced on-chain, then verify the deployed program and client artifacts are in sync without disturbing existing PDAs.
todos:
  - id: verify-upgrade-authority
    content: Confirm the current devnet program address and upgrade authority for `ELmVnLSNuwNca4PfPqeqNowoUF8aDdtfto3rF9d89wf`.
    status: completed
  - id: build-program
    content: Build and sanity-check the program on the authority machine before upgrading.
    status: completed
  - id: upgrade-same-id
    content: Upgrade the existing devnet program using the same program ID and upgrade authority wallet.
    status: completed
  - id: sync-client-artifacts
    content: Refresh any IDL or generated client artifacts the web app depends on after the upgrade.
    status: completed
  - id: verify-min-price
    content: Validate on devnet that below-minimum listing create/update calls fail while minimum-price calls succeed and existing state still loads.
    status: completed
isProject: false
---

# Redeploy Plan

## Goal

Upgrade the existing Solana program at `ELmVnLSNuwNca4PfPqeqNowoUF8aDdtfto3rF9d89wf` so the new on-chain minimum listing price (`0.001 SOL`) is enforced for create/update listing instructions.

## Relevant Files

- [Anchor.toml](/Users/andysustic/Repos/agent-reputation-oracle/Anchor.toml)
- [programs/reputation-oracle/src/lib.rs](/Users/andysustic/Repos/agent-reputation-oracle/programs/reputation-oracle/src/lib.rs)
- [programs/reputation-oracle/src/state/skill_listing.rs](/Users/andysustic/Repos/agent-reputation-oracle/programs/reputation-oracle/src/state/skill_listing.rs)
- [programs/reputation-oracle/src/instructions/create_skill_listing.rs](/Users/andysustic/Repos/agent-reputation-oracle/programs/reputation-oracle/src/instructions/create_skill_listing.rs)
- [programs/reputation-oracle/src/instructions/update_skill_listing.rs](/Users/andysustic/Repos/agent-reputation-oracle/programs/reputation-oracle/src/instructions/update_skill_listing.rs)
- [web/reputation_oracle.json](/Users/andysustic/Repos/agent-reputation-oracle/web/reputation_oracle.json)
- [web/scripts/generate-client.ts](/Users/andysustic/Repos/agent-reputation-oracle/web/scripts/generate-client.ts)
- [scripts/init-config.ts](/Users/andysustic/Repos/agent-reputation-oracle/scripts/init-config.ts)

## Why This Upgrade Is Safe

- Program ID is unchanged in both `Anchor.toml` and `lib.rs`.
- PDA seeds are unchanged for agent profiles and skill listings.
- Account layouts did not change; this is validation logic only.
- Existing `AgentProfile` and `SkillListing` accounts should remain readable after a same-ID upgrade.

## Redeploy Steps

1. On the computer with the upgrade authority keypair, verify the current upgrade authority and program ID:
  - `solana program show ELmVnLSNuwNca4PfPqeqNowoUF8aDdtfto3rF9d89wf`
  - Confirm the upgrade authority matches the keypair you control.
2. Set the deploy environment to devnet and the authority wallet:
  - `solana config set --url https://api.devnet.solana.com`
  - `export ANCHOR_PROVIDER_URL=https://api.devnet.solana.com`
  - `export ANCHOR_WALLET=/path/to/upgrade-authority-keypair.json`
3. Build and verify the program before deployment:
  - `anchor build`
  - `cargo check` in `programs/reputation-oracle`
4. Upgrade the program at the existing address:
  - `anchor deploy --provider.cluster devnet`
  - If Anchor needs the explicit upgrade authority, use the same authority wallet from `ANCHOR_WALLET`.
5. Verify the deployed behavior and metadata:
  - Re-run `solana program show ELmVnLSNuwNca4PfPqeqNowoUF8aDdtfto3rF9d89wf`
  - Confirm the program is still at the same address and remains upgradeable.
6. Sync client artifacts if needed:
  - Confirm `target/idl/reputation_oracle.json` matches expectations.
  - Refresh [web/reputation_oracle.json](/Users/andysustic/Repos/agent-reputation-oracle/web/reputation_oracle.json) if your frontend relies on the generated IDL.
  - Re-run [web/scripts/generate-client.ts](/Users/andysustic/Repos/agent-reputation-oracle/web/scripts/generate-client.ts) if generated client code depends on the rebuilt IDL.
7. Run post-upgrade validation on devnet:
  - Attempt to create or update a listing below `0.001 SOL` and confirm it fails on-chain.
  - Attempt the same at `0.001 SOL` and confirm it succeeds.
  - Confirm an existing agent profile and an existing skill listing still load in the app.

## Expected Behavior After Upgrade

- New listing creates below `1_000_000` lamports fail on-chain.
- Listing updates below `1_000_000` lamports fail on-chain.
- Existing low-price listings are not wiped; they remain on-chain until updated.
- Existing agent profiles and skill listing PDAs remain intact.

## Repo-Specific Gotchas

- `Anchor.toml` defaults to `localnet`, so use `--provider.cluster devnet` explicitly.
- Some docs still mention old program IDs; use `Anchor.toml` and `lib.rs` as the source of truth.
- If you accidentally deploy with a new program ID instead of upgrading the current one, existing PDAs will not carry over cleanly.
- `scripts/init-config.ts` is only needed if you are re-initializing config on a fresh deployment; it should not be required for a same-ID logic-only upgrade.

## Verification Proof To Collect

- Output of `solana program show ...` before and after upgrade.
- Successful `anchor build` / `cargo check`.
- One failing below-minimum transaction and one successful minimum-price transaction on devnet.
- A quick UI/API check that an existing profile and listing still resolve correctly.

