---
name: agentvouch mcp decision
overview: Recommend against adding a broad new AgentVouch MCP server as a primary integration surface right now. If IDE-native tools are still a priority, build only a thin local MCP wrapper on top of the existing API/CLI/protocol instead of creating a second protocol surface.
todos:
  - id: complete-openapi
    content: Fill out the public API contract before adding a new transport surface.
    status: pending
  - id: decide-mcp-scope
    content: Decide whether the goal is host-native tool UX or genuinely new protocol capability.
    status: pending
  - id: thin-local-wrapper
    content: If MCP is still wanted, build only a thin local wrapper over existing shared modules and wallet tooling.
    status: pending
isProject: false
---

# AgentVouch MCP Recommendation

## Recommendation
Do **not** add a full standalone AgentVouch MCP server yet.

The repo already has three usable agent-facing surfaces:
- Public REST and x402-style download flow in [`/Users/andysustic/Repos/agent-reputation-oracle/web/public/skill.md`](/Users/andysustic/Repos/agent-reputation-oracle/web/public/skill.md)
- A headless JSON-first CLI in [`/Users/andysustic/Repos/agent-reputation-oracle/packages/agentvouch-cli/src/cli.ts`](/Users/andysustic/Repos/agent-reputation-oracle/packages/agentvouch-cli/src/cli.ts)
- Shared auth/payment message contracts in [`/Users/andysustic/Repos/agent-reputation-oracle/packages/agentvouch-protocol/src/index.ts`](/Users/andysustic/Repos/agent-reputation-oracle/packages/agentvouch-protocol/src/index.ts)

An MCP server would mostly improve host UX, not capability. It would **not** remove the hard parts of the system:
- paid downloads still require `purchaseSkill` on-chain
- access still depends on a valid `Purchase` PDA
- `X-AgentVouch-Auth` still depends on a short-lived signed message
- write flows still need local wallet/key custody

## Why
Current evidence in the repo:
- [`/Users/andysustic/Repos/agent-reputation-oracle/web/public/skill.md`](/Users/andysustic/Repos/agent-reputation-oracle/web/public/skill.md) already documents browse, trust, install, paid download, publish, versioning, and CLI flows.
- [`/Users/andysustic/Repos/agent-reputation-oracle/packages/agentvouch-cli/src/cli.ts`](/Users/andysustic/Repos/agent-reputation-oracle/packages/agentvouch-cli/src/cli.ts) already exposes `skill list|inspect|install|publish`, `skills update`, `author register`, and `vouch create`, with `--json` and `--dry-run` for automation.
- [`/Users/andysustic/Repos/agent-reputation-oracle/web/public/openapi.json`](/Users/andysustic/Repos/agent-reputation-oracle/web/public/openapi.json) is still partial. That is a higher-leverage gap than adding a second transport.
- [`/Users/andysustic/Repos/agent-reputation-oracle/docs/ARCHITECTURE.md`](/Users/andysustic/Repos/agent-reputation-oracle/docs/ARCHITECTURE.md) already frames the product around Web UI, HTTP/x402, and direct RPC.

## Best Path
1. Strengthen the existing contract first.
Add the missing routes and auth/payment schemas to [`/Users/andysustic/Repos/agent-reputation-oracle/web/public/openapi.json`](/Users/andysustic/Repos/agent-reputation-oracle/web/public/openapi.json), especially `/api/skills/{id}/raw`, `/api/skills/{id}/install`, `POST /api/skills`, `PATCH /api/skills/{id}`, and version routes.

2. Keep business logic shared.
If you later add MCP, it should call the same shared modules behind the CLI and protocol package rather than reimplementing purchase/signature logic.

3. Only build MCP for clear host-native value.
Good MCP use cases:
- IDE-native `list_skills`, `inspect_skill`, `get_author_trust`
- composed free-skill install flows
- guided paid-install orchestration when paired with a wallet/signing MCP

4. Avoid a remote signing MCP design.
For paid installs and publish/vouch flows, a remote MCP server worsens key-custody risk. Keep it local, or delegate signing to an existing wallet MCP instead of storing keys inside AgentVouch MCP.

5. Consider packaging before protocol expansion.
If the actual need is easier agent adoption, publishing the CLI or generated SDK may deliver more value than maintaining a new MCP server.

## Decision Rule
Build an AgentVouch MCP server **only if** the goal is: “make AgentVouch feel like first-class named tools inside Cursor/Claude/Desktop hosts.”

Do **not** build it if the goal is: “unlock new protocol capability” or “simplify paid purchase/auth logic,” because MCP does not solve those parts.

## If You Decide To Build It
Scope V1 narrowly:
- read-only tools first: `list_skills`, `inspect_skill`, `get_author_trust`, `list_authors`
- optional free install tool next
- paid install only as orchestration over existing HTTP + purchase proof + wallet signing
- no duplicated on-chain logic; reuse the current protocol and CLI internals
- no server-side custody of user keys