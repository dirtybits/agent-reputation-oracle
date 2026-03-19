---
name: vouch stake redeploy
overview: Redeploy the existing `reputation_oracle` devnet program at the same program ID to enable stake top-ups and same-PDA re-vouch flows, then verify the new vouch lifecycle on devnet and document the full operator runbook.
todos:
  - id: verify-authority-and-target
    content: Confirm the devnet program address, upgrade authority wallet, and current deployed metadata for the same-ID upgrade target.
    status: completed
  - id: review-upgrade-safety
    content: Verify the vouch/stake commit is layout-safe for an in-place upgrade by checking program ID, PDA seeds, and account compatibility.
    status: completed
  - id: build-and-upgrade
    content: Build the program and upgrade the existing devnet program in place with the upgrade-authority wallet.
    status: completed
  - id: sync-idl-and-client
    content: Refresh `target/idl/reputation_oracle.json`, sync `web/reputation_oracle.json`, and regenerate any checked-in web client artifacts.
    status: completed
  - id: validate-vouch-lifecycle
    content: "Run devnet smoke tests for new and existing vouch flows: below-minimum rejection, top-up, revoke/re-vouch on same PDA, and dispute-related live-state behavior."
    status: completed
  - id: write-runbook
    content: Document the repeatable redeploy workflow, including prerequisites, commands, validation checklist, optional IDL init/upgrade guidance, and rollback/abort criteria.
    status: completed
isProject: false
---

# Vouch Stake Redeploy Plan

## Goal

Upgrade the existing Solana program at `ELmVnLSNuwNca4PfPqeqNowoUF8aDdtfto3rF9d89wf` so users can add stake to a live vouch and re-vouch using the same PDA after revocation, then capture the workflow in a reusable redeploy runbook.

## Why This Upgrade Looks Safe

- This is still a same-ID upgrade path, using `[Anchor.toml](/Users/andy/Repos/agent-reputation-oracle/Anchor.toml)` and `[programs/reputation-oracle/src/lib.rs](/Users/andy/Repos/agent-reputation-oracle/programs/reputation-oracle/src/lib.rs)` as the source of truth for the program address.
- The commit changes behavior, not storage layout: `[programs/reputation-oracle/src/state/vouch.rs](/Users/andy/Repos/agent-reputation-oracle/programs/reputation-oracle/src/state/vouch.rs)` only adds helper methods, while `[programs/reputation-oracle/src/instructions/vouch.rs](/Users/andy/Repos/agent-reputation-oracle/programs/reputation-oracle/src/instructions/vouch.rs)` switches to `init_if_needed` and top-up/reactivation logic without changing PDA seeds.
- Existing `Vouch`, `AgentProfile`, and config accounts should remain readable after the upgrade, but the behavioral semantics for legacy `Vindicated` and `Revoked` vouches must be revalidated on devnet.

## Relevant Files

- [Anchor.toml](/Users/andy/Repos/agent-reputation-oracle/Anchor.toml)
- [programs/reputation-oracle/Cargo.toml](/Users/andy/Repos/agent-reputation-oracle/programs/reputation-oracle/Cargo.toml)
- [programs/reputation-oracle/src/lib.rs](/Users/andy/Repos/agent-reputation-oracle/programs/reputation-oracle/src/lib.rs)
- [programs/reputation-oracle/src/instructions/vouch.rs](/Users/andy/Repos/agent-reputation-oracle/programs/reputation-oracle/src/instructions/vouch.rs)
- [programs/reputation-oracle/src/instructions/revoke_vouch.rs](/Users/andy/Repos/agent-reputation-oracle/programs/reputation-oracle/src/instructions/revoke_vouch.rs)
- [programs/reputation-oracle/src/instructions/resolve_dispute.rs](/Users/andy/Repos/agent-reputation-oracle/programs/reputation-oracle/src/instructions/resolve_dispute.rs)
- [programs/reputation-oracle/src/state/vouch.rs](/Users/andy/Repos/agent-reputation-oracle/programs/reputation-oracle/src/state/vouch.rs)
- [tests/reputation-oracle.ts](/Users/andy/Repos/agent-reputation-oracle/tests/reputation-oracle.ts)
- [web/reputation_oracle.json](/Users/andy/Repos/agent-reputation-oracle/web/reputation_oracle.json)
- [web/scripts/generate-client.ts](/Users/andy/Repos/agent-reputation-oracle/web/scripts/generate-client.ts)
- [docs/program-upgrades-and-redploys.md](/Users/andy/Repos/agent-reputation-oracle/docs/program-upgrades-and-redploys.md)

## Execution Plan

1. Verify the current devnet deploy target and authority.
  - Capture `solana program show ELmVnLSNuwNca4PfPqeqNowoUF8aDdtfto3rF9d89wf` before making changes.
  - Confirm the configured wallet pubkey matches the program upgrade authority.
2. Re-check same-ID upgrade safety before shipping.
  - Confirm the latest vouch/stake commit keeps the same program ID and PDA seeds.
  - Confirm there is no account size or enum serialization change that would require migration rather than upgrade.
  - Pay special attention to the new reuse logic in `[programs/reputation-oracle/src/instructions/vouch.rs](/Users/andy/Repos/agent-reputation-oracle/programs/reputation-oracle/src/instructions/vouch.rs)` and the `is_live()` behavior in `[programs/reputation-oracle/src/state/vouch.rs](/Users/andy/Repos/agent-reputation-oracle/programs/reputation-oracle/src/state/vouch.rs)`.
3. Build and redeploy the program in place on devnet.
  - Use the same cluster and upgrade-authority environment pattern as the previous redeploy.
  - Run `anchor build` and `cargo check` first.
  - Upgrade the existing program address in place rather than relying on any mismatched local program keypair artifact.
  - Re-run `solana program show ...` after upgrade and record the new deployed slot.
4. Sync checked-in client artifacts.
  - Refresh `target/idl/reputation_oracle.json` from the build output.
  - Copy the updated IDL into `[web/reputation_oracle.json](/Users/andy/Repos/agent-reputation-oracle/web/reputation_oracle.json)`.
  - Re-run `[web/scripts/generate-client.ts](/Users/andy/Repos/agent-reputation-oracle/web/scripts/generate-client.ts)` so generated exports and error surfaces match the deployed program.
  - Keep the on-chain IDL step optional unless we explicitly choose to initialize the Anchor IDL account.
5. Validate the new vouch lifecycle on devnet.
  - Confirm an existing `Vouch` PDA and `AgentProfile` still decode after the upgrade.
  - Prove below-minimum vouchs are still rejected according to config `min_stake`.
  - Create a new valid vouch and confirm stake is recorded.
  - Top up an existing live vouch and confirm `stake_amount` increases instead of being overwritten.
  - Revoke a vouch, then re-vouch using the same PDA and confirm it reactivates correctly.
  - Validate dispute-related state transitions touched by the commit: at minimum, confirm a live/vindicated relationship is revocable and a non-reusable state still rejects new stake.
  - Save transaction signatures and decoded account snapshots as proof.
6. Finish by writing the redeploy runbook.
  - Update `[docs/program-upgrades-and-redploys.md](/Users/andy/Repos/agent-reputation-oracle/docs/program-upgrades-and-redploys.md)` into a true operator runbook, not just an IDL note.
  - Include prerequisites, required env vars, exact command order, client sync steps, validation checklist, optional `anchor idl init` / `anchor idl upgrade` guidance, and stop/rollback criteria.
  - Include a small section on how this vouch/stake upgrade differs from the earlier minimum-price-only redeploy: it mutates stake-bearing state, so behavioral smoke tests are broader.

## Verification Proof To Collect

- `solana program show ...` output before and after upgrade.
- Successful `anchor build` and `cargo check` output.
- One successful top-up transaction on an existing live vouch.
- One successful revoke then re-vouch flow on the same PDA.
- One rejected invalid-state or below-minimum transaction with the expected custom error.
- Confirmation that updated web artifacts decode the new errors and instruction surface.
- The final runbook at `[docs/program-upgrades-and-redploys.md](/Users/andy/Repos/agent-reputation-oracle/docs/program-upgrades-and-redploys.md)`.

## Done When

- The devnet program at the existing address has been upgraded in place.
- The repo IDL and generated client artifacts match the deployed program.
- The new stake/vouch behaviors are proven on devnet with saved signatures.
- The redeploy runbook is clear enough to repeat the process without relying on chat history.

