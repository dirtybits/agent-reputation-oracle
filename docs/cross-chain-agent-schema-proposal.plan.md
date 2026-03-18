Use `ERC-8004` for agent identity, not as the universal primary key for the whole system.

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
  canonical_agent_id TEXT NOT NULL UNIQUE,   -- exact ERC-8004 ID
  display_name VARCHAR(128),
  home_chain VARCHAR(32),                    -- 'solana', 'base', etc.
  identity_source VARCHAR(32) NOT NULL,      -- 'erc8004', 'local', 'imported'
  status VARCHAR(16) NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

`canonical_agent_id` should use the exact ERC-8004 shape for agents:
- `solana:mainnet:<registry>#<agentId>`
- `eip155:8453:<registry>#<agentId>`

### `agent_identity_bindings`
Maps one logical agent to concrete wallets, program accounts, or registry records.

```sql
CREATE TABLE agent_identity_bindings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  binding_type VARCHAR(32) NOT NULL,         -- 'wallet', 'erc8004_registry', 'agent_profile_pda'
  chain_context VARCHAR(32) NOT NULL,        -- 'solana', 'base'
  address TEXT NOT NULL,                     -- wallet, PDA, contract account, registry key
  registry_address TEXT,                     -- ERC-8004 registry if relevant
  external_agent_id TEXT,                    -- raw ERC-8004 agent id if relevant
  is_primary BOOLEAN NOT NULL DEFAULT false,
  verification_status VARCHAR(16) NOT NULL DEFAULT 'verified',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(chain_context, address),
  UNIQUE(agent_id, binding_type, chain_context, address)
);
```

This is the table that lets one agent own:
- a Solana wallet
- a Base wallet
- a Solana AgentProfile PDA
- an ERC-8004 registry reference

### `foreign_agents`
Optional, only if you want imports to be explicit.

```sql
CREATE TABLE foreign_agents (
  agent_id UUID PRIMARY KEY REFERENCES agents(id) ON DELETE CASCADE,
  origin_chain VARCHAR(32) NOT NULL,
  origin_registry TEXT,
  import_source VARCHAR(32) NOT NULL,        -- 'erc8004', 'wormhole', 'manual'
  last_synced_at TIMESTAMPTZ,
  raw_metadata JSONB NOT NULL DEFAULT '{}'
);
```

I would only add this if imported agents need separate lifecycle handling. Otherwise fold these fields into `agents`.

### `skills`
Keep `skills.id` as your internal primary key. Add canonical IDs instead of making ERC-8004 do this job.

```sql
ALTER TABLE skills
  ADD COLUMN author_agent_id UUID REFERENCES agents(id),
  ADD COLUMN canonical_skill_id TEXT,        -- ex: agentvouch:solana:<listing>#<skill_id>
  ADD COLUMN source_chain VARCHAR(32) DEFAULT 'solana',
  ADD COLUMN settlement_chain VARCHAR(32) DEFAULT 'solana',
  ADD COLUMN settlement_address TEXT;        -- PDA or contract address
```

Important:
- `author_pubkey` can stay temporarily for compatibility
- `author_agent_id` should become the real foreign key
- `canonical_skill_id` should be your own format, not ERC-8004

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
  settlement_chain VARCHAR(32) NOT NULL,     -- 'solana', 'base'
  settlement_network_id VARCHAR(32),         -- 'devnet', '8453', etc.
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
- future reputation attestations

Do not use it for:
- skill IDs
- purchase IDs
- dispute IDs
- payout IDs

Those should stay internal and chain-aware.

## Migration Path

1. Add `agents` and `agent_identity_bindings`.
2. Backfill every existing `author_pubkey` into:
   - one `agents` row
   - one Solana wallet binding
3. Add `skills.author_agent_id`.
4. Start resolving author pages and trust lookups through `author_agent_id`, not raw pubkey.
5. Add `purchase_records` before Base support.
6. Only then add Base settlement adapters and foreign agent imports.

## Opinionated Call

The clean model is:
- `ERC-8004` = who the agent is
- `AgentVouch` = how trust, stake, dispute, and payouts are computed
- `x402` = how payment is negotiated over HTTP
- `purchase_records` + `chain_context` = how multichain settlement is tracked

If you want, I can turn this into an actual Postgres migration draft and API shape next.