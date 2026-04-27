# Reputation Oracle Program Redeploy Runbook

## Scope

This runbook covers same-program-ID redeploys of the Solana program at:

- Program ID: `ELmVnLSNuwNca4PfPqeqNowoUF8aDdtfto3rF9d89wf`
- Cluster: `devnet`

Use this runbook when:

- the program ID is unchanged
- PDA seeds are unchanged
- account layouts are unchanged
- you want to upgrade logic in place without migrating existing PDAs

Do not use this runbook for fresh deployments, program ID changes, or account migrations.

## Prerequisites

- You control the upgrade authority wallet for the target program.
- Solana CLI and Anchor are installed locally.
- The working tree contains the exact code you want to deploy.
- The program changes have been reviewed for:
  - unchanged `declare_id!`
  - unchanged PDA seed formulas
  - unchanged account sizes and serialized field order

Source-of-truth files to check before any redeploy:

- `Anchor.toml`
- `programs/reputation-oracle/src/lib.rs`
- relevant instruction/state files for the feature being shipped

## Environment

```bash
export ANCHOR_PROVIDER_URL=https://api.devnet.solana.com
export ANCHOR_WALLET=/path/to/deploy-authority.json
PROGRAM_ID=ELmVnLSNuwNca4PfPqeqNowoUF8aDdtfto3rF9d89wf
```

## Preflight

1. Verify the currently deployed target:

```bash
solana program show "$PROGRAM_ID"
```

1. Confirm the configured wallet matches the upgrade authority:

```bash
solana config get
solana-keygen pubkey "$ANCHOR_WALLET"
```

1. Confirm the repo still points at the same program ID:

```bash
rg "ELmVnLSNuwNca4PfPqeqNowoUF8aDdtfto3rF9d89wf" Anchor.toml programs/reputation-oracle/src/lib.rs
```

## Build

Build and sanity-check the program before touching devnet:

```bash
anchor build
cargo check --manifest-path programs/reputation-oracle/Cargo.toml
```

Notes:

- `Anchor.toml` defaults to `localnet`, so the cluster must be set explicitly during deploy.
- The local `target/deploy/reputation_oracle-keypair.json` may not match the production program ID. Do not assume `anchor deploy` is safe without checking.

Optional sanity check:

```bash
solana-keygen pubkey target/deploy/reputation_oracle-keypair.json
```

## Redeploy

Prefer an explicit same-ID upgrade command:

```bash
solana program deploy \
  target/deploy/reputation_oracle.so \
  --program-id "$PROGRAM_ID" \
  --upgrade-authority "$ANCHOR_WALLET" \
  -u https://api.devnet.solana.com
```

Then re-verify metadata:

```bash
solana program show "$PROGRAM_ID"
```

Collect:

- program ID
- authority
- post-upgrade deployed slot
- transaction signature from the deploy command

## Client Artifact Sync

Refresh local artifacts after every successful redeploy:

1. Confirm the built IDL exists:

```bash
shasum -a 256 target/idl/reputation_oracle.json web/reputation_oracle.json
```

1. If the checked-in IDL differs, copy the built IDL into the web app copy:

```bash
cp target/idl/reputation_oracle.json web/reputation_oracle.json
```

1. Regenerate checked-in client artifacts:

```bash
npm run generate:client
```

1. Check the diff:

```bash
git status --short
```

## Validation Checklist

Every redeploy should end with fresh devnet proof, not assumptions.

### Baseline checks

- Existing `AgentProfile` accounts still decode.
- Existing feature-specific accounts still decode.

### For listing-price logic changes

- Below-minimum listing create fails with the expected custom error.
- Below-minimum listing update fails with the expected custom error.
- Minimum-price create/update still succeed.

### For vouch/stake logic changes

- Below-minimum vouch stake fails with `StakeBelowMinimum`.
- A new valid vouch succeeds.
- Topping up a live vouch increases `stake_amount`.
- Revoking a vouch works and updates profile aggregates.
- Re-vouching after revocation reuses the same PDA successfully.
- Non-reusable states reject new stake with `VouchNotReusable`.
- If dispute handling changed, validate the affected dispute resolution path too.

### Recommended proof bundle

- `solana program show ...` before and after
- successful `anchor build` and `cargo check`
- tx signature for each smoke test
- decoded account snapshots or summarized field values after each key transition

## Stop and Abort Criteria

Stop immediately if any of these are true before deploy:

- program ID changed unexpectedly
- PDA seed derivation changed unexpectedly
- account size or field ordering changed unexpectedly
- deploy wallet is not the upgrade authority

Stop immediately after deploy and do not claim success if:

- the program address changed
- the post-deploy authority changed unexpectedly
- old PDAs fail to decode
- web/client artifacts no longer match the built IDL
- validation transactions do not produce the expected behavior

## Rollback Notes

- A rollback is another same-ID upgrade using the previous known-good program binary and the same upgrade authority.
- Do not attempt rollback without preserving:
  - the prior commit SHA
  - the prior deploy artifact or reproducible build input
  - the failing validation evidence

## Anchor IDL: Optional but Useful

The on-chain Anchor IDL account is optional for this repo. The program works without it if `web/reputation_oracle.json` is your source of truth.

Initialize it once:

```bash
anchor idl init \
  --provider.cluster devnet \
  --provider.wallet "$ANCHOR_WALLET" \
  --filepath target/idl/reputation_oracle.json \
  "$PROGRAM_ID"
```

After it exists, future metadata updates use:

```bash
anchor idl upgrade \
  --provider.cluster devnet \
  --provider.wallet "$ANCHOR_WALLET" \
  --filepath target/idl/reputation_oracle.json \
  "$PROGRAM_ID"
```

Why initialize it:

- explorers and Anchor tooling can fetch the IDL directly
- future `anchor idl upgrade` commands will work
- third-party integrations can discover the interface more easily

Why skip it:

- the program logic still works fine
- existing PDAs are unaffected either way
- local checked-in IDL may already be sufficient for this app

## How This Differs From The Minimum-Price Redeploy

The minimum-price redeploy only tightened validation on listing instructions. The vouch/stake redeploy is riskier operationally because it changes the lifecycle of stake-bearing state:

- reusing an existing vouch PDA
- topping up live stake
- reactivating revoked relationships
- altering dispute-to-active behavior after vindication

That means the validation matrix must cover state transitions and aggregate counters, not just single-instruction rejection or acceptance.