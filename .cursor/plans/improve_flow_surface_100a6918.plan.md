---
name: Improve flow surface
overview: "Address the highest-impact issues from live AgentVouch flow testing: repair the broken CLI publish path, align trust outputs and docs with the real API contract, and restore regression coverage around paid-download and agent-facing flows."
todos:
  - id: fix-cli-publish-path
    content: Repair the CLI publish/on-chain listing path and verify live publish succeeds end-to-end
    status: pending
  - id: align-trust-surface
    content: Align trust endpoint, CLI summaries, and docs so agents see one consistent trust contract
    status: pending
  - id: restore-flow-tests
    content: Fix the paid-download/auth test harness and source-based UI assertions so web regression coverage is green
    status: pending
  - id: expand-agent-docs
    content: Upgrade /docs to cover the same critical agent flows already documented in skill.md
    status: pending
  - id: add-smoke-verification
    content: Add targeted smoke checks for the exact live flows that regressed or were ambiguous in testing
    status: pending
isProject: false
---

# Improve AgentVouch Flow Surface

## Goals
- Make the documented and actual agent flow surface consistent enough that a headless agent can browse, evaluate trust, install, publish, and version skills without hidden assumptions.
- Prioritize the live breakage first, then fix the contract mismatches that caused confusion during testing.

## Priority 1: Repair the Broken Publish Path
- Fix the live `agentvouch skill publish` failure in [packages/agentvouch-cli/src/lib/solana.ts](/Users/andy/Repos/agent-reputation-oracle/packages/agentvouch-cli/src/lib/solana.ts).
- Investigate the Anchor `BN` import/usage path used here:

```12:13:packages/agentvouch-cli/src/lib/solana.ts
const { AnchorProvider, BN, Program, Wallet, web3 } = anchor;
```

```215:222:packages/agentvouch-cli/src/lib/solana.ts
const tx = await this.program.methods
  .createSkillListing(
    input.skillId,
    input.skillUri,
    input.name,
    input.description,
    new BN(input.priceLamports)
  )
```

- Normalize the bigint/BN handling so both `createSkillListing()` and `vouch()` use the same safe numeric conversion path.
- Verify with:
  - `npm run test:cli`
  - a dry-run publish
  - a live devnet publish using a disposable `SKILL.md`
  - a follow-up `GET /api/skills/{id}` proving the linked `on_chain_address` exists

## Priority 2: Unify the Trust Contract Across API, CLI, and Docs
- Decide on one canonical machine-readable trust shape for agent consumers and use it consistently.
- Update [packages/agentvouch-cli/src/cli.ts](/Users/andy/Repos/agent-reputation-oracle/packages/agentvouch-cli/src/cli.ts) so text summaries stop reading legacy/nonexistent keys:

```42:54:packages/agentvouch-cli/src/cli.ts
function formatSkillSummary(skill: SkillRecord): string[] {
  return [
    `${skill.name}`,
    `id: ${skill.id}`,
    `skill_id: ${skill.skill_id}`,
    `source: ${skill.source ?? "repo"}`,
    `author: ${skill.author_pubkey}`,
    `price_lamports: ${skill.price_lamports ?? 0}`,
    `listing: ${skill.on_chain_address ?? "none"}`,
    `registered: ${skill.author_trust?.isRegistered ? "yes" : "no"}`,
    `active_author_disputes: ${skill.author_trust?.activeAuthorDisputes ?? 0}`,
    `upheld_author_disputes: ${skill.author_trust?.upheldAuthorDisputes ?? 0}`,
  ];
}
```

- Review whether [web/app/api/agents/[pubkey]/trust/route.ts](/Users/andy/Repos/agent-reputation-oracle/web/app/api/agents/[pubkey]/trust/route.ts) should keep its wrapped payload, expose a flatter top-level summary, or both:

```30:37:web/app/api/agents/[pubkey]/trust/route.ts
return NextResponse.json(
  {
    pubkey,
    trust: trustSummary,
    author_trust: trust,
    author_identity: identity,
    author_disputes: disputes,
  },
```

- Reflect the final decision in [web/public/skill.md](/Users/andy/Repos/agent-reputation-oracle/web/public/skill.md) and the CLI help/examples.
- Verify with:
  - `agentvouch skill list`
  - `agentvouch skill inspect`
  - `curl -sL /api/agents/{pubkey}/trust`
  - trust-focused tests in `web/__tests__/api` and CLI formatting assertions

## Priority 3: Restore Regression Coverage Around Paid Flows
- Fix the raw-download test harness so the web suite reflects the real auth code again.
- The immediate mismatch is in [web/lib/auth.ts](/Users/andy/Repos/agent-reputation-oracle/web/lib/auth.ts):

```26:28:web/lib/auth.ts
export function normalizeProtocolNewlines(value: string): string {
  return value.replace(/\r\n/g, "\n");
}
```

- Update mocks/tests around `skills-raw` so they include the newline normalization export and cover CRLF acceptance, verified-pubkey purchase checks, and correct `401/402/200` behavior.
- Revisit the failing source-based UI tests so they assert the current purchase disclosure vocabulary rather than stale strings if the product wording intentionally changed.
- Verify with:
  - `npm run test:web`
  - targeted `vitest` runs for `skills-raw`, `agent-trust-route`, and the skills page/detail source tests

## Priority 4: Make `/docs` a Real Agent Entry Surface
- Expand [web/app/docs/page.tsx](/Users/andy/Repos/agent-reputation-oracle/web/app/docs/page.tsx) so an agent that starts at `/docs` can discover the same core flows already present in `skill.md`.
- Add or link clearly for:
  - `GET /api/skills/{id}` inspect
  - direct trust lookup
  - discovery endpoints (`/api/index/skills`, `/.well-known/agentvouch.json`, `skill.md`, `openapi.json`)
  - author register, publish, and version-add flows
  - the fact that `skill.md` is the canonical full contract
- Keep `web/public/skill.md` as the source of truth; `/docs` should be a concise but complete on-ramp, not a divergent partial contract.
- Verify by comparing `/docs`, `skill.md`, and CLI help for the full flow matrix used in the test run.

## Priority 5: Add Flow-Level Smoke Checks
- Add a small verification layer that exercises the exact flows that failed or were ambiguous in testing.
- Prefer smoke checks that are deterministic and cheap:
  - readonly HTTP checks for list, inspect, trust, and discovery
  - CLI JSON checks for list/inspect/install dry-run
  - publish dry-run plus targeted unit coverage for the on-chain wrapper
- If live signed coverage remains important, isolate it behind an explicit env-gated smoke path instead of mixing it into default CI.

## Verification Exit Criteria
- `npm run test:cli` passes
- `npm run test:web` passes
- `agentvouch skill publish` succeeds on devnet with a disposable skill fixture
- CLI text and JSON outputs expose trust/dispute state consistently with the API
- `/docs` and `web/public/skill.md` no longer disagree about what an agent can do or where to start