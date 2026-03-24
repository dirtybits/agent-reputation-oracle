---
name: auto-resolve-registry
overview: Add indexer-first Solana Agent Registry discovery to the self-linking author flow so users can find and link live registry identities by wallet without manually pasting asset metadata. Keep persistence, canonical ID composition, and settlement behavior unchanged.
todos:
  - id: registry-adapter
    content: Add an indexer-first Solana Agent Registry discovery adapter with normalized candidate output and caching
    status: completed
  - id: registry-discovery-api
    content: Add a self-linking discovery API for author wallets and reuse the existing persistence path for selected candidates
    status: completed
  - id: author-ui-discovery
    content: Replace manual registry inputs on the author page with candidate discovery and selection, keeping a manual fallback
    status: completed
  - id: verify-registry-discovery
    content: Add tests and run npm test plus npm run build
    status: completed
isProject: false
---

# Auto-Resolve Registry Metadata

## Goal

Replace the manual Solana Agent Registry linking form with an indexer-first discovery flow that finds candidate registry identities for the current wallet, lets the user choose one when needed, and persists the selected binding through the existing identity model.

## Implementation

- Add a new server-only adapter at [web/lib/solanaAgentRegistry.ts](web/lib/solanaAgentRegistry.ts) to query a public Solana Agent Registry/indexer by wallet and normalize results into one internal candidate shape: `registryAddress`, `coreAssetPubkey`, `ownerWallet`, `operationalWallet`, `displayName`, `metadataUri`, `registrations`, `rawUpstreamChainLabel`, `rawUpstreamChainId`.
- Add short-lived in-memory caching in that adapter, similar to [web/lib/trust.ts](web/lib/trust.ts), so repeated author-page refreshes do not re-hit the upstream registry immediately.
- Add a discovery endpoint, likely [web/app/api/author/[pubkey]/discover-registry/route.ts](web/app/api/author/[pubkey]/discover-registry/route.ts), that verifies the caller is the same wallet as the author, requires an existing AgentProfile, and returns discovered candidates without persisting anything.
- Keep persistence in [web/app/api/author/[pubkey]/route.ts](web/app/api/author/[pubkey]/route.ts), but allow it to accept a selected discovered candidate and pass normalized upstream metadata into [web/lib/agentIdentity.ts](web/lib/agentIdentity.ts). Reuse `linkSolanaRegistryIdentity()` rather than creating a second persistence path.
- Extend [web/lib/agentIdentity.ts](web/lib/agentIdentity.ts) only where needed to store discovered metadata cleanly: set `agents.display_name` from registry data when present and preserve raw upstream labels in existing raw fields. Keep canonical ID composition and CAIP-2 chain normalization unchanged.
- Replace the manual inputs in [web/app/author/[pubkey]/page.tsx](web/app/author/[pubkey]/page.tsx) with a discovery-first UI: `Find my registry identities`, loading/empty/error states, compact candidate cards, single-click link action, and a fallback manual entry path kept behind a secondary affordance for debugging or indexer misses.
- Leave read-only consumer surfaces additive only. [web/app/api/skills/route.ts](web/app/api/skills/route.ts), [web/app/api/skills/[id]/route.ts](web/app/api/skills/[id]/route.ts), [web/app/api/landing/route.ts](web/app/api/landing/route.ts), and [web/components/AgentIdentityPanel.tsx](web/components/AgentIdentityPanel.tsx) should continue reading stored identity data and not perform live discovery.

## Verification

- Add focused tests for discovery result normalization, no-match and multi-match cases, wallet mismatch rejection, and successful persistence of a selected candidate.
- Run `npm test` in [web/package.json](web/package.json).
- Run `npm run build` in [web/package.json](web/package.json).
- Manually verify `/author/[pubkey]`: discover candidates, select one, link it, refresh, and confirm [web/components/AgentIdentityPanel.tsx](web/components/AgentIdentityPanel.tsx) shows the linked registry identity.

