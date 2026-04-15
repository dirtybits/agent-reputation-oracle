Use `ERC-8004` and Solana Agent Registry for agent identity. Do not use them as the universal primary key for the whole system.

## Current Reality

AgentVouch already ships most of the identity and chain-normalization foundation that this proposal originally described.

- Normalized chain labels already live in `web/lib/chains.ts`.
- Repo-backed skills already persist `chain_context` in `web/lib/db.ts`, and legacy values are backfilled into CAIP-2-style values.
- `agents` and `agent_identity_bindings` already exist in `web/lib/agentIdentity.ts`.
- Canonical agent IDs already exist and are built as `<caip2-chain-id>:<registryOrProgram>#<recordId>` for linked registry identities, plus a local fallback form for non-registry identities.
- Solana 8004 discovery and linking already exist in `web/lib/solanaAgentRegistry.ts` and `web/app/api/author/[pubkey]/route.ts`.
- Trust, API, and CLI surfaces already expose `canonical_agent_id` and `chain_context`.
- x402 already carries `chainContext`, but payment verification is still explicitly Solana-only in `web/lib/x402.ts`.
- The product truth today is still Solana-native settlement and trust enforcement, consistent with `docs/ARCHITECTURE.md` and `web/public/skill.md`.

The old version of this document was directionally right, but it incorrectly treated already-shipped identity tables and chain normalization as future work.

## Built

### Chain Normalization

Stored chain values already use normalized CAIP-2-style labels for persisted `chain_context` fields.

Current examples:

- Solana Devnet: `solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1`
- Solana Mainnet: `solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp`
- Base: `eip155:8453`

Rules already reflected in the codebase:

- Persist normalized CAIP-2 values in normalized chain fields.
- Accept legacy aliases like `solana`, `solana:mainnet`, `solana:mainnet-beta`, `base`, and `ethereum` only at the edge.
- Preserve non-CAIP upstream labels separately when an external registry or SDK does not use CAIP-2.

### Current Skill Schema

The repo-backed `skills` table is still primarily keyed around local marketplace needs, but it already carries normalized chain context:

```sql
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
  chain_context VARCHAR(64) DEFAULT <configured_caip2_chain>,
  total_installs INTEGER DEFAULT 0,
  contact VARCHAR(128),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(author_pubkey, skill_id)
);
```

What matters here:

- `skills.id` remains the internal primary key.
- `author_pubkey` is still the compatibility anchor for existing repo skill rows.
- `chain_context` is already real and already normalized.

### Current Agent Identity Schema

The identity layer is already present and should now be treated as the baseline, not a proposal:

```sql
CREATE TABLE IF NOT EXISTS agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_agent_id TEXT NOT NULL UNIQUE,
  display_name VARCHAR(128),
  home_chain_context VARCHAR(64),
  identity_source VARCHAR(32) NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_identity_bindings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  binding_type VARCHAR(32) NOT NULL,
  chain_context VARCHAR(64) NOT NULL,
  binding_ref TEXT NOT NULL,
  registry_address TEXT,
  external_agent_id TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  verification_status VARCHAR(16) NOT NULL DEFAULT 'verified',
  raw_upstream_chain_label TEXT,
  raw_upstream_chain_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(agent_id, binding_type, chain_context, binding_ref)
);
```

This is already enough to model:

- owner wallet
- operational wallet
- local `AgentProfile` PDA
- Solana 8004 asset identity
- future EVM 8004 token identity

Canonical identity rules:

- `canonical_agent_id` should point to the registry-native identity record when one exists.
- It should not collapse registry-native identity down to a wallet address.
- It is an AgentVouch application identifier that uses a CAIP-2 chain prefix. It is not itself a CAIP standard.

Current shapes:

- local fallback: `<caip2-chain-id>:agentvouch-local#<walletPubkey>`
- Solana 8004: `<caip2-chain-id>:<agentRegistryProgram>#<coreAssetPubkey>`
- future EVM 8004: `<caip2-chain-id>:<identityRegistry>#<tokenId>`

### Current Solana Registry Integration

Solana 8004 support is already partially operational:

- discovery by owner or operational wallet already exists
- registry candidates already carry `chainContext`
- raw upstream chain label and raw upstream chain id are already preserved
- registry linking already rewrites an agent from local identity to registry-backed canonical identity

This means the correct framing is:

- Solana registry-aware identity is live
- non-Solana cross-chain identity is not live

## Partial / Reserved

The following pieces exist as compatibility or future-facing groundwork, but should not be described as full cross-chain support.

### Legacy Alias Compatibility

Legacy network aliases are still accepted at the edge for compatibility:

- `solana`
- `solana:mainnet`
- `solana:mainnet-beta`
- `solana:devnet`
- `base`
- `ethereum`

That is an input compatibility layer, not a signal that storage remains unnormalized.

### Reserved Binding Surfaces

`agent_identity_bindings` already leaves room for future identity surfaces such as:

- `evm_8004_token`
- `wallet_operational`
- `raw_upstream_chain_label`
- `raw_upstream_chain_id`
- `external_agent_id`

Important:

- `evm_8004_token` exists as a binding type today, but there is no EVM linking flow yet.
- raw upstream labels should stay in separate metadata fields rather than replacing normalized `chain_context`.
- this is reserved schema space, not shipped Base or Ethereum support.

### Solana-Only Settlement

The marketplace and purchase flow are still Solana-only today:

- `purchase_skill` is a Solana instruction
- x402 verification requires `network: "solana"`
- `chainContext` in x402 is checked against the configured Solana chain
- the on-chain program under `programs/reputation-oracle/` does not yet model non-Solana settlement

This is the key product boundary:

- AgentVouch is already cross-chain-aware in identity and schema language
- AgentVouch is not yet cross-chain in marketplace settlement

## Not Yet Built

The following parts remain future work:

- `foreign_agents` table
- `skills.author_agent_id`
- `skills.canonical_skill_id`
- `skills.source_chain_context`
- `skills.settlement_chain_context`
- `skills.settlement_address`
- `purchase_records`
- non-Solana settlement adapters
- foreign-agent import lifecycle
- any Base or EVM purchase-verification path

None of those should be implied as live until there is end-to-end product support for them.

## How To Use ERC-8004

Use it for:

- canonical agent identity
- registry-backed identity linking
- foreign agent imports when they become real product needs
- cross-chain profile resolution
- future reputation portability and attestations

Do not use it for:

- skill IDs
- purchase IDs
- dispute IDs
- payout IDs
- immediate replacement of local Solana `AgentProfile`
- collapsing owner wallet, operational wallet, and local PDA into one field

Those surfaces should remain internal and chain-aware.

## Next Credible Phases

The next steps should be sequenced around real product needs, not around abstract multichain completeness.

### Phase 1: Attach Skills To The Existing Identity Layer

This is the smallest credible next schema step.

Add:

```sql
ALTER TABLE skills
  ADD COLUMN author_agent_id UUID REFERENCES agents(id);
```

Then:

1. Backfill every existing `author_pubkey` to the already-existing `agents` table.
2. Ensure each existing author has a `wallet_owner` binding on the correct normalized Solana `chain_context`.
3. Add an `agent_profile_pda` binding where the profile exists.
4. Populate `skills.author_agent_id`.
5. Keep `author_pubkey` for compatibility until all readers prefer `author_agent_id`.

This phase should update author resolution and trust lookups to prefer the identity layer without pretending the marketplace is already multichain.

### Phase 2: Add Foreign Identity Import Only When There Is A Real Use Case

Only add explicit foreign-agent lifecycle storage if AgentVouch actually needs to ingest and reason about non-Solana agents.

If that becomes real, two acceptable designs exist:

- add a dedicated `foreign_agents` table
- keep the model flatter and store import metadata directly on `agents` plus bindings

If a dedicated table is needed, the minimum useful shape is:

```sql
CREATE TABLE foreign_agents (
  agent_id UUID PRIMARY KEY REFERENCES agents(id) ON DELETE CASCADE,
  origin_chain_context VARCHAR(64) NOT NULL,
  origin_registry TEXT,
  import_source VARCHAR(32) NOT NULL,
  raw_upstream_chain_label TEXT,
  raw_upstream_chain_id TEXT,
  last_synced_at TIMESTAMPTZ,
  raw_metadata JSONB NOT NULL DEFAULT '{}'
);
```

Do not add this table just because the old proposal mentioned it. Add it only when imported agents truly need separate lifecycle, sync, or verification handling.

### Phase 3: Add Canonical Skill IDs And Purchase Records Only When Settlement Stops Being Solana-Only

Do not add chain-agnostic purchase bookkeeping ahead of a real multichain settlement path.

When that need becomes real, extend `skills` with:

```sql
ALTER TABLE skills
  ADD COLUMN canonical_skill_id TEXT,
  ADD COLUMN source_chain_context VARCHAR(64),
  ADD COLUMN settlement_chain_context VARCHAR(64),
  ADD COLUMN settlement_address TEXT;
```

And then add:

```sql
CREATE TABLE purchase_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_id UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  buyer_agent_id UUID REFERENCES agents(id),
  buyer_binding_id UUID REFERENCES agent_identity_bindings(id),
  payment_ref TEXT NOT NULL UNIQUE,
  settlement_id TEXT,
  payment_protocol VARCHAR(32) NOT NULL,
  settlement_chain_context VARCHAR(64) NOT NULL,
  settlement_address TEXT,
  tx_hash TEXT,
  mint TEXT,
  amount NUMERIC(78,0) NOT NULL,
  verification_status VARCHAR(16) NOT NULL,
  settlement_status VARCHAR(24) NOT NULL,
  resource_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  verified_at TIMESTAMPTZ
);
```

This phase is justified only when AgentVouch truly supports:

- more than one settlement chain
- more than one purchase verification path
- more than one entitlement source

Until then, the current Solana purchase proof and `Purchase` PDA remain the source of truth.

### Phase 4: Add Non-Solana Settlement Adapters

Only after a concrete Base or EVM purchase path exists should AgentVouch add:

- non-Solana x402 settlement adapters
- non-Solana entitlement verification
- chain-specific settlement address handling
- cross-chain purchase reconciliation

This should be shipped only when the user-facing flow is complete end to end:

1. payment requirement generation
2. settlement execution
3. proof verification
4. entitlement unlock
5. support in docs, API responses, and CLI flows

## Opinionated Call

The clean model is:

- `ERC-8004` / Solana Agent Registry = who the agent is
- `AgentVouch` = how trust, stake, dispute, and payouts are computed
- `x402` = how payment is negotiated over HTTP
- `chain_context` = the normalization layer that keeps identities and future settlement legible across chains

The correct next move is not to expand speculative multichain schema first. The correct next move is to finish adopting the identity layer that already exists, starting with `skills.author_agent_id`, and only then add foreign-agent or multichain settlement tables when the product actually needs them.