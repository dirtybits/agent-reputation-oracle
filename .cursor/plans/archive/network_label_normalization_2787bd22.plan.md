---
name: Network Label Normalization
overview: Make CAIP-2 the only persisted network label format across AgentVouch, keep non-standard upstream labels in separate fields when needed, and treat human-friendly aliases as input/display only.
todos:
  - id: lock-canonical-format
    content: Make CAIP-2 the only persisted format for chain_context-style fields and document alias and upstream-label handling rules
    status: completed
  - id: update-strategy-plan
    content: Update agent-registry-strategy plan to use CAIP-2 labels and note raw upstream registry labels are preserved separately when needed
    status: completed
  - id: update-schema-plan
    content: Update cross-chain-schema-proposal to replace bare chain fields with chain_context fields and remove mixed label formats
    status: completed
  - id: update-supporting-docs
    content: Update TODO.md and related plan examples so canonical IDs and examples no longer use solana, solana:mainnet, or solana:mainnet-beta
    status: completed
  - id: implementation-followup
    content: Add a normalization utility, alias map, and one-time legacy backfill for persisted solana values
    status: completed
isProject: false
---

# Network Label Normalization

## Canonical Decision

This document is the canonical plan for network label normalization. Other plans and docs should be updated to conform to it.

- Persist CAIP-2 chain IDs in every `chain_context` or `*_chain_context` field.
- Treat `solana`, `solana:mainnet`, and `solana:mainnet-beta` as legacy aliases only.
- Preserve raw upstream network labels in separate fields when external registries or SDKs do not use CAIP-2.
- Treat `canonical_agent_id` as an AgentVouch-defined identifier whose chain prefix is a CAIP-2 chain ID.

## Canonical Stored Values

Use these values for persisted chain identifiers:

- Solana mainnet: `solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp`
- Solana devnet: `solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1`
- Solana testnet: `solana:4uhcVJyU9pJkvQyS88uRDiswHXSCkY3z`
- Ethereum mainnet: `eip155:1`
- Base: `eip155:8453`
- Polygon: `eip155:137`

Do not persist display aliases such as `Solana`, `Solana Devnet`, `Base`, or cluster names such as `mainnet-beta`.

## Why This Needs To Change

The repo currently mixes multiple incompatible formats for the same concept:

- [web/lib/db.ts](/Users/andysustic/Repos/agent-reputation-oracle/web/lib/db.ts) persists bare `solana`.
- [TODO.md](/Users/andysustic/Repos/agent-reputation-oracle/TODO.md) uses `solana:mainnet:...`.
- [.cursor/plans/agent-registry-strategy_ad1c3fc0.plan.md](/Users/andysustic/Repos/agent-reputation-oracle/.cursor/plans/agent-registry-strategy_ad1c3fc0.plan.md) uses `solana:mainnet-beta` and `solana:devnet`.
- [docs/cross-chain-agent-schema-proposal.plan.md](/Users/andysustic/Repos/agent-reputation-oracle/docs/cross-chain-agent-schema-proposal.plan.md) uses the same `solana:mainnet-beta` style.
- Older multi-chain planning docs still use bare `solana` as a placeholder.

This creates silent join failures, inconsistent APIs, and ambiguous migration paths.

CAIP-2 gives a stable `namespace:reference` format for chain identification. For Solana, the `reference` is the truncated genesis hash, which makes the chain ID deterministic and network-specific.

## Normalization Rules

### 1. Storage Rule

Persist only CAIP-2 values in normalized chain fields.

- Use `chain_context` or `*_chain_context` for normalized stored values.
- Prefer `VARCHAR(64)` or `TEXT` for these fields. `VARCHAR(16)` is too short for Solana CAIP-2 IDs.
- Replace bare fields like `source_chain`, `settlement_chain`, and `origin_chain` with `source_chain_context`, `settlement_chain_context`, and `origin_chain_context` where practical.

### 2. Input Rule

Accept friendly or legacy aliases at the API edge, but normalize immediately before persistence.

Suggested accepted aliases:

- `solana`
- `solana-mainnet`
- `solana:mainnet`
- `solana:mainnet-beta`
- `solana-devnet`
- `solana:devnet`
- `base`

Suggested normalization targets:

- `solana`, `solana-mainnet`, `solana:mainnet`, `solana:mainnet-beta` -> `solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp`
- `solana-devnet`, `solana:devnet` -> `solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1`
- `base` -> `eip155:8453`

Never persist the alias after normalization.

### 3. Upstream Interop Rule

Some upstream systems will not use CAIP-2 labels consistently.

- If Solana Agent Registry, 8004 tooling, or another SDK returns a non-CAIP network label, preserve the original upstream value in a separate field or raw metadata blob.
- Do not use raw upstream labels as join keys, foreign keys, or normalized filters.
- The normalized field remains CAIP-2 even when the upstream representation differs.

Example separate fields:

- `raw_upstream_chain_label`
- `raw_upstream_chain_id`
- `raw_metadata JSONB`

### 4. Display Rule

Use a small alias utility for UI labels. Display labels should not leak into storage.

```typescript
const CHAIN_ALIASES: Record<string, string> = {
  'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp': 'Solana',
  'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1': 'Solana Devnet',
  'eip155:1': 'Ethereum',
  'eip155:8453': 'Base',
};
```

### 5. ID Composition Rule

`canonical_agent_id` is not itself a CAIP standard. It is an AgentVouch identifier built from a CAIP-2 chain ID plus a registry or program identifier and a record identifier.

Recommended shape:

```text
<caip2-chain-id>:<registryOrProgram>#<recordId>
```

Examples:

```text
solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp:<agentRegistryProgram>#<coreAssetPubkey>
eip155:8453:<identityRegistry>#<tokenId>
```

Parsing rule:

- The first two colon-delimited segments are the CAIP-2 `chain_context`.
- The remainder before `#` is the registry or program identifier.
- The value after `#` is the record identifier.

### 6. Migration Rule

Do not leave persistence ambiguous.

- New writes should persist CAIP-2 only.
- Existing stored `solana` values need a one-time backfill based on deployment environment or known source context.
- If a legacy row cannot be mapped confidently to a concrete network, mark it for manual resolution rather than guessing silently.

Do not keep bare `solana` as a long-term stored fallback.

## Review Of Current Plan Docs

### [.cursor/plans/agent-registry-strategy_ad1c3fc0.plan.md](/Users/andysustic/Repos/agent-reputation-oracle/.cursor/plans/agent-registry-strategy_ad1c3fc0.plan.md)

This doc is directionally correct but should be updated to match the canonical rules above.

- Replace `solana:mainnet-beta` with `solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp`.
- Replace `solana:devnet` with `solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1`.
- Clarify that non-standard upstream registry labels may be preserved separately, but normalized `chain_context` stays CAIP-2.
- Note that normalized chain fields should use `VARCHAR(64)` or `TEXT`.

### [docs/cross-chain-agent-schema-proposal.plan.md](/Users/andysustic/Repos/agent-reputation-oracle/docs/cross-chain-agent-schema-proposal.plan.md)

This doc also points in the right direction but still mixes normalized and non-normalized fields.

- Replace all Solana network labels with CAIP-2 equivalents.
- Change `foreign_agents.origin_chain` to `origin_chain_context`.
- Replace `source_chain` and `settlement_chain` with `source_chain_context` and `settlement_chain_context`.
- Remove `settlement_network_id` and fold that information into `settlement_chain_context`.
- Update examples so `canonical_skill_id` and related examples no longer use bare `solana`.
- Widen `VARCHAR` sizes for normalized chain fields.

### Supporting Docs And Code

These should also conform to the canonical rule:

- [TODO.md](/Users/andysustic/Repos/agent-reputation-oracle/TODO.md) should stop using `solana:mainnet`.
- [web/lib/db.ts](/Users/andysustic/Repos/agent-reputation-oracle/web/lib/db.ts) should stop defaulting to bare `solana`.
- [web/app/api/skills/route.ts](/Users/andysustic/Repos/agent-reputation-oracle/web/app/api/skills/route.ts) should normalize output and persistence to CAIP-2 when this work is executed.

## Recommended Execution Order

1. Update the two strategy docs so they stop asserting conflicting formats.
2. Update supporting docs and examples so new planning work does not reintroduce legacy labels.
3. Add a shared normalization utility and alias map.
4. Widen normalized chain fields in live schemas.
5. Backfill persisted legacy values.

## Bottom Line

Use CAIP-2 as the only stored network label format.

- CAIP-2 goes in normalized storage fields.
- Human-friendly labels stay at the UI and API edge.
- Raw upstream labels stay in separate metadata when needed.
- Older plans should conform to this document, not the other way around.
