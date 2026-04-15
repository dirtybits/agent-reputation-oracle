---
name: cross-chain plan rewrite
overview: Rewrite the cross-chain agent schema proposal so it reflects what AgentVouch already ships today, what is only partial groundwork, and what remains future roadmap. The updated plan should stop treating the existing CAIP-2 and agent-identity foundation as hypothetical, while keeping the remaining cross-chain work scoped to credible next phases.
todos:
  - id: audit-current-state
    content: Turn the current repo evidence into a built / partial / missing matrix for the existing cross-chain proposal.
    status: completed
  - id: rewrite-plan-document
    content: Rewrite `.cursor/plans/cross-chain-agent-schema-proposal.plan.md` so it reflects the shipped CAIP-2 and identity foundation instead of re-proposing it.
    status: completed
  - id: rephase-remaining-work
    content: Reduce speculative multichain schema work into staged future phases gated on real foreign-agent and non-Solana settlement needs.
    status: completed
isProject: false
---

# Rewrite Cross-Chain Schema Plan

## Goal
Replace the stale proposal in [`.cursor/plans/cross-chain-agent-schema-proposal.plan.md`](/Users/andysustic/Repos/agent-reputation-oracle/.cursor/plans/cross-chain-agent-schema-proposal.plan.md) with a reality-based plan that matches the current AgentVouch codebase.

## Current State To Capture

### Already Built
- CAIP-2-style chain normalization is already live in [`web/lib/chains.ts`](/Users/andysustic/Repos/agent-reputation-oracle/web/lib/chains.ts).
  - Solana uses normalized values like `solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1`.
  - Legacy aliases like `solana`, `solana:mainnet`, `base`, and `ethereum` are normalized at the edge.
- Repo-backed skills already persist normalized `chain_context` in [`web/lib/db.ts`](/Users/andysustic/Repos/agent-reputation-oracle/web/lib/db.ts).
  - The DB initializer backfills legacy labels into CAIP-2 values.
- The `agents` and `agent_identity_bindings` tables already exist in [`web/lib/agentIdentity.ts`](/Users/andysustic/Repos/agent-reputation-oracle/web/lib/agentIdentity.ts).
  - `agents` already has `canonical_agent_id`, `home_chain_context`, and `identity_source`.
  - `agent_identity_bindings` already has `binding_type`, `chain_context`, `registry_address`, `external_agent_id`, `raw_upstream_chain_label`, and `raw_upstream_chain_id`.
- Canonical agent IDs are already generated in [`web/lib/agentIdentity.ts`](/Users/andysustic/Repos/agent-reputation-oracle/web/lib/agentIdentity.ts) via `buildLocalCanonicalAgentId()` and `buildRegistryCanonicalAgentId()`.
- Solana 8004 discovery and linking already exist in [`web/lib/solanaAgentRegistry.ts`](/Users/andysustic/Repos/agent-reputation-oracle/web/lib/solanaAgentRegistry.ts) and [`web/app/api/author/[pubkey]/route.ts`](/Users/andysustic/Repos/agent-reputation-oracle/web/app/api/author/[pubkey]/route.ts).
- Trust/API/CLI surfaces already expose `canonical_agent_id` and `chain_context` in:
  - [`web/lib/agentDiscovery.ts`](/Users/andysustic/Repos/agent-reputation-oracle/web/lib/agentDiscovery.ts)
  - [`packages/agentvouch-cli/src/lib/http.ts`](/Users/andysustic/Repos/agent-reputation-oracle/packages/agentvouch-cli/src/lib/http.ts)
  - [`web/public/skill.md`](/Users/andysustic/Repos/agent-reputation-oracle/web/public/skill.md)
- x402 already carries `chainContext`, but payment verification is still explicitly Solana-only in [`web/lib/x402.ts`](/Users/andysustic/Repos/agent-reputation-oracle/web/lib/x402.ts).

### Partial Groundwork
- Legacy network aliases are still accepted for compatibility in [`web/lib/chains.ts`](/Users/andysustic/Repos/agent-reputation-oracle/web/lib/chains.ts).
- `evm_8004_token` exists as a binding type in [`web/lib/agentIdentity.ts`](/Users/andysustic/Repos/agent-reputation-oracle/web/lib/agentIdentity.ts), but there is no EVM linking flow yet.
- The current registry-linking path is Solana-specific even though the schema leaves room for foreign identities.

### Not Built
- No `foreign_agents` table exists.
- `skills` does not yet have `author_agent_id`, `canonical_skill_id`, `source_chain_context`, `settlement_chain_context`, or `settlement_address`.
- No `purchase_records` table exists.
- No non-Solana settlement adapter exists.
- The on-chain program remains Solana-only; there is no on-chain `chain_context` or EVM/Base settlement path under [`programs/reputation-oracle/`](/Users/andysustic/Repos/agent-reputation-oracle/programs/reputation-oracle).

## Rewrite Shape
Update [`.cursor/plans/cross-chain-agent-schema-proposal.plan.md`](/Users/andysustic/Repos/agent-reputation-oracle/.cursor/plans/cross-chain-agent-schema-proposal.plan.md) so it has four explicit sections:

1. `Current Reality`
- Describe the shipped identity/network baseline.
- State clearly that AgentVouch already has CAIP-2 normalization plus a real agent identity layer.
- State clearly that marketplace settlement and trust enforcement are still Solana-native today.

2. `Built`
- Mark the identity and chain-normalization foundation as complete.
- Include the existing DB/runtime tables instead of re-proposing them as greenfield schema.

3. `Partial / Reserved`
- Keep `evm_8004_token`, raw upstream chain metadata, and alias compatibility as reserved compatibility layers rather than calling them full cross-chain support.

4. `Next Credible Phases`
- Phase 1: make `skills` point at the existing identity layer with `author_agent_id` while keeping `author_pubkey` for compatibility.
- Phase 2: add foreign identity import only when there is an actual read/use case for non-Solana agents.
- Phase 3: add canonical skill IDs and chain-agnostic purchase records only when AgentVouch truly supports multi-chain settlement.
- Phase 4: add non-Solana settlement adapters after the product has a concrete Base/EVM purchase path.

## Rewrite Principles
- Do not describe existing tables as future work.
- Keep CAIP-2 as the canonical stored format for all normalized chain fields.
- Keep raw upstream labels in separate metadata fields when external systems do not use CAIP-2.
- Keep the product truth explicit: current AgentVouch is cross-chain-aware in identity/schema language, but not yet cross-chain in marketplace settlement.
- Prefer the smallest credible next schema step: `skills.author_agent_id` backfill before introducing broader multichain purchase tables.

## Files To Reconcile While Rewriting
- Primary target: [`.cursor/plans/cross-chain-agent-schema-proposal.plan.md`](/Users/andysustic/Repos/agent-reputation-oracle/.cursor/plans/cross-chain-agent-schema-proposal.plan.md)
- Source of truth for chain semantics: [`web/lib/chains.ts`](/Users/andysustic/Repos/agent-reputation-oracle/web/lib/chains.ts)
- Source of truth for current skill schema: [`web/lib/db.ts`](/Users/andysustic/Repos/agent-reputation-oracle/web/lib/db.ts)
- Source of truth for identity schema: [`web/lib/agentIdentity.ts`](/Users/andysustic/Repos/agent-reputation-oracle/web/lib/agentIdentity.ts)
- Source of truth for registry integration: [`web/lib/solanaAgentRegistry.ts`](/Users/andysustic/Repos/agent-reputation-oracle/web/lib/solanaAgentRegistry.ts)
- Source of truth for current shipped architecture: [`docs/ARCHITECTURE.md`](/Users/andysustic/Repos/agent-reputation-oracle/docs/ARCHITECTURE.md)
- Source of truth for user-facing contract: [`web/public/skill.md`](/Users/andysustic/Repos/agent-reputation-oracle/web/public/skill.md)
- Optional backlog alignment check: [`TODO.md`](/Users/andysustic/Repos/agent-reputation-oracle/TODO.md)
