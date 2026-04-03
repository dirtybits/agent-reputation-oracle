Use `ERC-8004` and Solana Agent Registry for agent identity, not as the universal primary key for the whole system.

Right now the repo is still keyed around Solana-specific fields like `author_pubkey` and `on_chain_address`:

```19:35:web/lib/db.ts
CREATE TABLE IF NOT EXISTS skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_id VARCHAR(64) NOT NULL,
  author_pubkey VARCHAR(44) NOT NULL,
  name VARCHAR(64) NOT NULL,
  description VARCHAR(256),
  tags TEXT[] DEFAULT '{}',
  current_version INTEGER DEFAULT 1,
  ipfs_cid VARCHAR(128),
  on_chain_address VARCHAR(44),
  chain_context VARCHAR(16) DEFAULT 'solana',
  total_installs INTEGER DEFAULT 0,
  contact VARCHAR(128),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(author_pubkey, skill_id)
)
```

And the plan already points at the right shift:

```403:410:docs/multi-asset-staking-and-x402-plan.md
## 5.4 Indexer / API / UI

- [ ] Extend indexer schema for multi-mint positions with `chain_context`.
- [ ] Add canonical cross-chain ID support (`namespace:chain:contract#id`) for agents/skills.
- [ ] Add endpoints for stake composition by agent.
- [ ] Add UI cards for per-mint stake and composition pie.
```

## Recommended Schema

### `agents`
One logical agent profile inside AgentVouch.

```sql
CREATE TABLE agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_agent_id TEXT NOT NULL UNIQUE,   -- ERC-8004-compatible canonical identity
  display_name VARCHAR(128),
  home_chain_context VARCHAR(64),            -- normalized CAIP-2 chain id: 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp', 'eip155:8453', etc.
  identity_source VARCHAR(32) NOT NULL,      -- 'erc8004', 'local', 'imported'
  status VARCHAR(16) NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

`canonical_agent_id` should point to the registry-native identity record, not a wallet and not an `AgentProfile` PDA.

`canonical_agent_id` is an AgentVouch-defined identifier whose chain prefix is a CAIP-2 chain ID. It is not itself a CAIP standard.

Recommended shapes:
- Solana 8004: `solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp:<agentRegistryProgram>#<coreAssetPubkey>`
- Solana 8004 (devnet): `solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1:<agentRegistryProgram>#<coreAssetPubkey>`
- EVM ERC-8004: `eip155:8453:<identityRegistry>#<tokenId>`

Notes:
- On Solana 8004, the unique record is the Metaplex Core asset pubkey.
- On EVM ERC-8004, the unique record is the ERC-721 token id under the identity registry contract.
- Store the identity losslessly. Do not collapse registry-native IDs down to wallet addresses.

### `agent_identity_bindings`
Maps one logical agent to concrete wallets, program accounts, or registry records.

```sql
CREATE TABLE agent_identity_bindings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  binding_type VARCHAR(32) NOT NULL,         -- 'solana_8004_asset', 'wallet_owner', 'wallet_operational', 'agent_profile_pda', 'evm_8004_token'
  chain_context VARCHAR(64) NOT NULL,        -- normalized CAIP-2 chain id: 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp', 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1', 'eip155:8453'
  binding_ref TEXT NOT NULL,                 -- wallet address, PDA, Core asset pubkey, or token id
  registry_address TEXT,                     -- registry program / contract if relevant
  external_agent_id TEXT,                    -- optional raw upstream identifier if distinct from binding_ref
  is_primary BOOLEAN NOT NULL DEFAULT false,
  verification_status VARCHAR(16) NOT NULL DEFAULT 'verified',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(agent_id, binding_type, chain_context, binding_ref)
);
```

This is the table that lets one agent own:
- a Solana 8004 identity asset
- a Solana owner wallet
- a Solana operational / agent wallet
- a Solana AgentProfile PDA
- an EVM ERC-8004 token

Important:
- Do not assume one wallet maps to one agent globally.
- Do not use a blanket `UNIQUE(chain_context, address)` rule for wallet rows.
- If you need one-to-one guarantees, add narrower partial unique indexes for identity surfaces like:
  - `solana_8004_asset`
  - `agent_profile_pda`

Examples:
- `binding_type = 'solana_8004_asset'`
  - `chain_context = 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp'`
  - `binding_ref = '<coreAssetPubkey>'`
  - `registry_address = '<agentRegistryProgram>'`
- `binding_type = 'wallet_owner'`
  - `binding_ref = '<walletPubkey>'`
- `binding_type = 'wallet_operational'`
  - `binding_ref = '<walletPubkey>'`
- `binding_type = 'agent_profile_pda'`
  - `binding_ref = '<agentProfilePda>'`
- `binding_type = 'evm_8004_token'`
  - `chain_context = 'eip155:8453'`
  - `binding_ref = '<tokenId>'`
  - `registry_address = '<identityRegistry>'`

### `foreign_agents`
Optional, only if you want imports to be explicit.

```sql
CREATE TABLE foreign_agents (
  agent_id UUID PRIMARY KEY REFERENCES agents(id) ON DELETE CASCADE,
  origin_chain_context VARCHAR(64) NOT NULL, -- normalized CAIP-2 chain id
  origin_registry TEXT,
  import_source VARCHAR(32) NOT NULL,        -- 'erc8004', 'wormhole', 'manual'
  raw_upstream_chain_label TEXT,
  raw_upstream_chain_id TEXT,
  last_synced_at TIMESTAMPTZ,
  raw_metadata JSONB NOT NULL DEFAULT '{}'
);
```

I would only add this if imported agents need separate lifecycle handling. Otherwise fold these fields into `agents`.

If you ingest external 8004 registration files, this is also a reasonable place to store raw `registrations[]` references, non-CAIP upstream chain labels, and sync metadata until they are verified and promoted into first-class bindings.

Important:
- `origin_chain_context` is the normalized CAIP-2 value used for joins and filters.
- `raw_upstream_chain_label` and `raw_upstream_chain_id` preserve upstream values when external systems do not use CAIP-2.

### `skills`
Keep `skills.id` as your internal primary key. Add canonical IDs instead of making ERC-8004 do this job.

```sql
ALTER TABLE skills
  ADD COLUMN author_agent_id UUID REFERENCES agents(id),
  ADD COLUMN canonical_skill_id TEXT,        -- ex: agentvouch:<caip2-chain-id>:<listing>#<skill_id>
  ADD COLUMN source_chain_context VARCHAR(64) NOT NULL,
  ADD COLUMN settlement_chain_context VARCHAR(64) NOT NULL,
  ADD COLUMN settlement_address TEXT;        -- PDA or contract address
```

Important:
- `author_pubkey` can stay temporarily for compatibility
- `author_agent_id` should become the real foreign key
- `canonical_skill_id` should be your own format, not ERC-8004
- `source_chain_context` and `settlement_chain_context` should use the same CAIP-2 normalization rules used elsewhere

### `purchase_records`
Make purchase and entitlement chain-agnostic.

```sql
CREATE TABLE purchase_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_id UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  buyer_agent_id UUID REFERENCES agents(id),
  buyer_binding_id UUID REFERENCES agent_identity_bindings(id),
  payment_ref TEXT NOT NULL UNIQUE,
  settlement_id TEXT,
  payment_protocol VARCHAR(32) NOT NULL,     -- 'direct', 'x402'
  settlement_chain_context VARCHAR(64) NOT NULL, -- normalized CAIP-2 chain id
  settlement_address TEXT,                   -- PDA or contract
  tx_hash TEXT,
  mint TEXT,
  amount NUMERIC(78,0) NOT NULL,
  verification_status VARCHAR(16) NOT NULL,  -- 'pending', 'valid', 'invalid'
  settlement_status VARCHAR(24) NOT NULL,    -- 'pending', 'complete', 'partial_failure', 'failed'
  resource_id TEXT NOT NULL,                 -- canonical skill/resource binding
  created_at TIMESTAMPTZ DEFAULT NOW(),
  verified_at TIMESTAMPTZ
);
```

This gives you one purchase model whether the user paid:
- directly on Solana
- via x402 + Solana settlement
- via x402 + Base settlement later

## How I’d Use ERC-8004

Use it for:
- canonical agent identity
- foreign agent imports
- cross-chain profile resolution
- upstream `registrations[]` references as cross-chain identity hints
- future reputation attestations

Do not use it for:
- skill IDs
- purchase IDs
- dispute IDs
- payout IDs
- immediate replacement of `AgentProfile`
- collapsing owner wallet, operational wallet, and local PDA into one field

Those should stay internal and chain-aware.

## Migration Path

1. Add `agents` and `agent_identity_bindings`.
2. Backfill every existing `author_pubkey` into:
   - one `agents` row
   - one `wallet_owner` binding on the correct CAIP-2 Solana network
   - one `agent_profile_pda` binding if the profile exists
3. Add `skills.author_agent_id`.
4. Start resolving author pages and trust lookups through `author_agent_id`, not raw pubkey.
5. Add optional Solana 8004 linking:
   - `solana_8004_asset`
   - owner wallet
   - operational wallet
6. Ingest `registrations[]` references from linked 8004 registration files as candidate foreign bindings, but require verification before trust.
7. Add `purchase_records` before Base support.
8. Only then add Base settlement adapters and foreign agent imports.

## Opinionated Call

The clean model is:
- `ERC-8004` / Solana Agent Registry = who the agent is
- `AgentVouch` = how trust, stake, dispute, and payouts are computed
- `x402` = how payment is negotiated over HTTP
- `purchase_records` + `chain_context` = how multichain settlement is tracked

If you want, I can turn this into an actual Postgres migration draft and API shape next.