# Deploy And IDL Runbook

## Devnet Program

- Program ID: `ELmVnLSNuwNca4PfPqeqNowoUF8aDdtfto3rF9d89wf`
- Upgrade authority: `<UPGRADE_AUTHORITY_PUBKEY>`
- Canonical program keypair: `<REPO_ROOT>/target/deploy/reputation_oracle-keypair.json`

## Important Constraint

`anchor deploy` needs two different keys to line up:

- the upgrade authority wallet
- the original program keypair for `ELmVnLSNuwNca4PfPqeqNowoUF8aDdtfto3rF9d89wf`

If the wallet is correct but the program keypair is wrong, Anchor will deploy a brand-new program at a different address and then fail IDL upload with `DeclaredProgramIdMismatch`.

## Preflight Checks

Run these from the repo root:

```bash
cd <REPO_ROOT>
```

Verify the upgrade authority wallet:

```bash
solana-keygen pubkey /path/to/deploy-authority.json
```

Expected output:

```bash
<UPGRADE_AUTHORITY_PUBKEY>
```

Verify the program keypair matches the declared program ID:

```bash
solana-keygen verify ELmVnLSNuwNca4PfPqeqNowoUF8aDdtfto3rF9d89wf \
  /path/to/program-keypair.json
```

Check devnet balance for the deploy authority:

```bash
solana balance --url https://api.devnet.solana.com \
  -k /path/to/deploy-authority.json
```

## Build

Export the deploy environment explicitly. `Anchor.toml` defaults to `localnet`, so do not rely on implicit defaults.

```bash
export ANCHOR_WALLET=/path/to/deploy-authority.json
export ANCHOR_PROVIDER_URL=https://api.devnet.solana.com
```

Build the program:

```bash
anchor build
```

If the deployed behavior still looks old, do not assume `anchor build` refreshed the executable. `anchor deploy` uploads `target/deploy/reputation_oracle.so`, so a stale `.so` can redeploy stale code even when the IDL and generated types are newer. In that case, force a clean rebuild:

```bash
anchor clean
anchor build
```

If the web app consumes the checked-in IDL or generated client, refresh those artifacts after the build:

```bash
cp target/idl/reputation_oracle.json web/reputation_oracle.json
npm run generate:client
```

## Deploy

Use the explicit program keypair so Anchor upgrades the existing program instead of creating a new one:

```bash
anchor deploy \
  --program-name reputation_oracle \
  --program-keypair /path/to/program-keypair.json \
  --provider.cluster devnet \
  --provider.wallet "$ANCHOR_WALLET"
```

## Bootstrap Program State

Deploying the executable does not initialize the program's PDA state. After deploying a fresh program ID, run `initialize_config` once before testing registration-dependent flows like skill listing, vouching, purchases, or author bonds.

For the USDC-native `agentvouch` program, `initialize_config` creates:

- the singleton `ReputationConfig` PDA from seed `["config"]`
- the protocol treasury USDC vault
- the x402 settlement USDC vault

Use the cluster's canonical USDC mint when initializing config. On devnet, that is:

```text
4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU
```

Set the config, treasury, settlement, and pause authorities deliberately. For a devnet smoke deploy, using the deploy payer for all four is acceptable; production should use the intended operations/admin authority model.

Dry-run the config initialization first:

```bash
export AGENTVOUCH_RPC_URL=https://api.devnet.solana.com
export AGENTVOUCH_WALLET=~/dev-keypair.json
export SOLANA_CHAIN_CONTEXT=solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1
export USDC_MINT=4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU

anchor run init-agentvouch-config
```

If the printed program ID, authorities, PDAs, and simulation result are correct, submit it:

```bash
INIT_AGENTVOUCH_CONFIG_APPLY=1 anchor run init-agentvouch-config
```

The script is idempotent. If the `config` PDA already exists, it prints the current config and exits without sending a transaction.

If this step is skipped, instructions that read `config` will fail even though the program account exists. A common symptom is skill listing simulation failing with Anchor `AccountNotInitialized` / `3012`:

```text
AnchorError caused by account: config.
Error Code: AccountNotInitialized.
Error Number: 3012.
Error Message: The program expected this account to be already initialized.
```

## Verify Program Upgrade

Check the on-chain program metadata:

```bash
solana program show --url https://api.devnet.solana.com \
  ELmVnLSNuwNca4PfPqeqNowoUF8aDdtfto3rF9d89wf
```

You should see:

- the same program ID: `ELmVnLSNuwNca4PfPqeqNowoUF8aDdtfto3rF9d89wf`
- authority: `<UPGRADE_AUTHORITY_PUBKEY>`
- a newer `Last Deployed In Slot`

Verify the executable binary too, not just the metadata:

```bash
solana program dump --url https://api.devnet.solana.com \
  ELmVnLSNuwNca4PfPqeqNowoUF8aDdtfto3rF9d89wf \
  /tmp/reputation_oracle_devnet.so

shasum -a 256 \
  target/deploy/reputation_oracle.so \
  /tmp/reputation_oracle_devnet.so
```

Those two hashes should match. If they do not, the deploy did not put the local executable on-chain.

## Anchor IDL

When `anchor deploy` succeeds with the correct program keypair, Anchor upgrades both:

- the executable program
- the on-chain IDL account

That IDL account makes the program self-describing for Anchor-aware tooling.

Fetch the on-chain IDL:

```bash
anchor idl fetch ELmVnLSNuwNca4PfPqeqNowoUF8aDdtfto3rF9d89wf \
  --provider.cluster devnet
```

Check the current IDL authority:

```bash
anchor idl authority ELmVnLSNuwNca4PfPqeqNowoUF8aDdtfto3rF9d89wf \
  --provider.cluster devnet
```

Upgrade the IDL manually if needed:

```bash
anchor idl upgrade \
  ELmVnLSNuwNca4PfPqeqNowoUF8aDdtfto3rF9d89wf \
  -f target/idl/reputation_oracle.json \
  --provider.cluster devnet \
  --provider.wallet "$ANCHOR_WALLET"
```

Initialize the IDL only if the program has never had one before:

```bash
anchor idl init \
  ELmVnLSNuwNca4PfPqeqNowoUF8aDdtfto3rF9d89wf \
  -f target/idl/reputation_oracle.json \
  --provider.cluster devnet \
  --provider.wallet "$ANCHOR_WALLET"
```

## Common Failure Mode

If you see:

```text
DeclaredProgramIdMismatch
```

it usually means:

- `declare_id!(...)` is still `ELmVn...`
- but `anchor deploy` used the wrong `reputation_oracle-keypair.json`
- so Anchor deployed to a different program ID and then failed the IDL step

## Post-Deploy Check

After a successful deploy:

1. Retry the author-wide dispute flow in the app.
2. Confirm the transaction targets `ELmVnLSNuwNca4PfPqeqNowoUF8aDdtfto3rF9d89wf`.
3. Confirm the UI either succeeds cleanly or surfaces a real on-chain error.

## IDL Verification And Fallback Triage

If the frontend throws `Fallback functions are not supported`, verify the deployed program and the web client are using the same interface.

Fetch the on-chain IDL:

```bash
anchor idl fetch ELmVnLSNuwNca4PfPqeqNowoUF8aDdtfto3rF9d89wf \
  --provider.cluster devnet
```

Compare it against:

- `target/idl/reputation_oracle.json`
- `web/reputation_oracle.json`

If the local files contain a new instruction but `anchor idl fetch` does not, the on-chain program/IDL is stale and needs a fresh build + deploy.

If `anchor idl fetch` contains the new instruction but the program still throws `Fallback functions are not supported`, the on-chain IDL may be newer than the deployed executable. In that case:

1. Run `anchor clean && anchor build`.
2. Redeploy with the canonical program keypair.
3. Compare `target/deploy/reputation_oracle.so` against `solana program dump` from the live program.

If `target/idl/reputation_oracle.json` contains the new instruction but `web/reputation_oracle.json` or `web/generated/reputation-oracle/` does not, the web client artifacts are stale and need to be regenerated:

```bash
cp target/idl/reputation_oracle.json web/reputation_oracle.json
npm run generate:client
```

### Quick Runbook

```bash
cd <REPO_ROOT>

mv target/deploy/reputation_oracle-keypair.json target/deploy/reputation_oracle-keypair.old.json
cp target/deploy/reputation_oracle_v2-keypair.json target/deploy/reputation_oracle-keypair.json

solana-keygen pubkey target/deploy/reputation_oracle-keypair.json
solana-keygen verify ELmVnLSNuwNca4PfPqeqNowoUF8aDdtfto3rF9d89wf target/deploy/reputation_oracle-keypair.json

export ANCHOR_WALLET=~/dev-keypair.json
export ANCHOR_PROVIDER_URL=https://api.devnet.solana.com

anchor clean
anchor build

anchor deploy \
  --program-name reputation_oracle \
  --program-keypair target/deploy/reputation_oracle-keypair.json \
  --provider.cluster devnet \
  --provider.wallet "$ANCHOR_WALLET"

solana program show --url https://api.devnet.solana.com ELmVnLSNuwNca4PfPqeqNowoUF8aDdtfto3rF9d89wf

cp target/idl/reputation_oracle.json web/reputation_oracle.json
npm run generate:client
pkill -f "next dev" || true
npm run dev
```

Expected checks:

- `solana-keygen pubkey ...` prints `ELmVnLSNuwNca4PfPqeqNowoUF8aDdtfto3rF9d89wf`
- `solana-keygen verify ...` succeeds
- `anchor deploy` upgrades instead of creating a new program
- `solana program show ...` shows the same program ID with a fresh deploy slot

If you want one extra safety check after deploy:

```bash
cd <REPO_ROOT>
solana program dump --url https://api.devnet.solana.com ELmVnLSNuwNca4PfPqeqNowoUF8aDdtfto3rF9d89wf /tmp/reputation_oracle_devnet.so
shasum -a 256 target/deploy/reputation_oracle.so /tmp/reputation_oracle_devnet.so
```

Those hashes should match.