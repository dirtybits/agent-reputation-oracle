# AgentVouch Production Runbook

This runbook covers the deployed `agentvouch` web app and the USDC-native `v0.2.0` devnet protocol.

## Production Shape

- Public app: `https://agentvouch.xyz`
- Vercel project: `agentvouch`
- Current Vercel root directory: `web/`
- Program ID: `AgNtCcWfeMYUzHxvGdZP5BJszQhx6NJGB4pQ7AN6XVWz`
- Cluster: Solana devnet
- Chain context: `solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1`
- Devnet USDC mint: `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`

## Environment Matrix

Set preview and production deliberately. Do not assume local `.env.local`, Vercel preview, and Vercel production point at the same Neon branch or RPC.

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | yes | Pooled Neon connection for runtime queries |
| `DATABASE_URL_UNPOOLED` | yes | Direct Neon connection for migrations/bootstrap |
| `SOLANA_RPC_URL` | yes | Server-side Solana reads and verification |
| `NEXT_PUBLIC_SOLANA_RPC_URL` | yes | Browser wallet/RPC hooks until all reads are server-mediated |
| `SOLANA_CHAIN_CONTEXT` | yes | Server-side CAIP-2 chain label |
| `NEXT_PUBLIC_SOLANA_CHAIN_CONTEXT` | yes | Browser-visible CAIP-2 chain label |
| `NEXT_PUBLIC_APP_URL` | recommended | Canonical public URL for generated links |

Keep `SOLANA_RPC_URL` and `NEXT_PUBLIC_SOLANA_RPC_URL` on the same cluster. A mismatch can make wallet flows look like protocol bugs.

## Deployment Checklist

1. Confirm the intended Neon branch/database for preview or production.
2. Confirm Solana env vars point at devnet and the active program/config.
3. Confirm `web/agentvouch.json` and `web/generated/agentvouch/` match `target/idl/agentvouch.json` after any Anchor change.
4. Run the web build locally:

```bash
npm run build --workspace @agentvouch/web
```

5. Deploy or promote through Vercel.
6. Smoke the deployed URL before announcing the cutover.

## Smoke Checks

Read-only checks:

```bash
curl -s https://agentvouch.xyz/api/skills | jq '.skills[:3]'
curl -s https://agentvouch.xyz/api/x402/supported | jq
curl -s https://agentvouch.xyz/skill.md | head
```

App checks:

- `/`
- `/skills`
- `/skills/{repo-skill-id}`
- `/author/{pubkey}`
- `/docs#paid-skill-download`

Protocol checks after program or client changes:

- Register an author.
- Deposit USDC author bond.
- Create USDC vouch.
- Publish a USDC listing.
- Purchase with `purchase_skill`.
- Verify purchase entitlement.
- Download raw skill with `X-AgentVouch-Auth`.
- Claim voucher rewards.
- Open and resolve a small devnet dispute after explicit approval.

Use dry runs and simulations first. Live devnet write smoke remains approval-gated:

```bash
npm run smoke:devnet-usdc
```

Only after approval:

```bash
npm run smoke:devnet-usdc -- --apply
```

## Authorities

Record the authority pubkeys for each environment before production changes:

- upgrade authority
- config authority
- treasury authority
- x402 settlement authority
- pause authority, when implemented

For the current devnet deployment, verify authority state with `solana program show` and the decoded `ReputationConfig` before assuming a local keypair is authorized.

## Rollback

Database rollback:

- Follow `docs/DATABASE_CUTOVER.md`.
- Restore Vercel `DATABASE_URL` and `DATABASE_URL_UNPOOLED` together.

Web rollback:

- Promote the last known-good Vercel deployment or revert the app commit and redeploy.
- Confirm public docs, `skill.md`, and API metadata still match the active program/config.

Program rollback:

- Follow `docs/program-upgrades-and-redploys.md`.
- Treat program rollback and web rollback as one coordinated action when IDL/client behavior changed.

## References

- `docs/DEPLOY.md`
- `docs/DATABASE_CUTOVER.md`
- `docs/program-upgrades-and-redploys.md`
- `docs/MAINNET_READINESS.md`
