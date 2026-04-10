---
name: Test agent flows
overview: Validate AgentVouch’s agent-facing flows across both the live surface and the local repo, combining readonly HTTP/CLI checks, existing automated tests, and live devnet wallet execution for the flows that truly require signing or purchases.
todos:
  - id: baseline-agent-surface
    content: Map and compare the documented agent-facing flows across skill.md, docs, CLI, and API routes
    status: completed
  - id: run-automated-validation
    content: Run existing web and CLI test suites that cover install, paid auth, publish, and trust flows
    status: completed
  - id: exercise-live-readonly-flows
    content: Validate live readonly agent flows against production-facing endpoints and CLI read commands
    status: completed
  - id: exercise-live-signed-flows
    content: Run live devnet signed flows for register, paid install, publish, and version add using the best-fit wallet path
    status: completed
  - id: write-flow-report
    content: Summarize pass/partial/fail for each flow with proof, blockers, and agent-UX conclusions
    status: completed
isProject: false
---

# Test AgentVouch Flows

## Scope
Validate the full agent-facing flow surface for AgentVouch with an "would an autonomous agent actually succeed here?" lens.

Confirmed scope:
- Target both the live surface at `https://agentvouch.xyz` and the local repo behavior.
- Use the best-fit signing method per flow.
- Use devnet-funded wallet paths for live transaction-required checks.

## Flow Matrix
Test these flows end-to-end or to the deepest safe point available:
- Browse/list skills
- Inspect skill detail
- Trust lookup
- Install a free skill
- Install a paid skill
- Publish a skill
- Add a version
- Agent discovery feeds / machine-readable entrypoints
- Supporting prerequisite flows when needed: author register and vouch

Key sources to validate against:
- [`web/public/skill.md`](/Users/andy/Repos/agent-reputation-oracle/web/public/skill.md)
- [`packages/agentvouch-cli/src/cli.ts`](/Users/andy/Repos/agent-reputation-oracle/packages/agentvouch-cli/src/cli.ts)
- [`web/app/api/skills/route.ts`](/Users/andy/Repos/agent-reputation-oracle/web/app/api/skills/route.ts)
- [`web/app/api/skills/[id]/route.ts`](/Users/andy/Repos/agent-reputation-oracle/web/app/api/skills/[id]/route.ts)
- [`web/app/api/skills/[id]/raw/route.ts`](/Users/andy/Repos/agent-reputation-oracle/web/app/api/skills/[id]/raw/route.ts)
- [`web/app/api/skills/[id]/versions/route.ts`](/Users/andy/Repos/agent-reputation-oracle/web/app/api/skills/[id]/versions/route.ts)
- [`web/app/api/author/[pubkey]/route.ts`](/Users/andy/Repos/agent-reputation-oracle/web/app/api/author/[pubkey]/route.ts)
- [`web/app/api/agents/[pubkey]/trust/route.ts`](/Users/andy/Repos/agent-reputation-oracle/web/app/api/agents/[pubkey]/trust/route.ts)

## Planned Execution
1. Baseline the documented flow surface.
Read the canonical docs and CLI help, then enumerate the exact commands/endpoints an agent would follow. Capture any mismatch between `web/public/skill.md`, `/docs`, and the CLI surface before running live checks.

2. Run existing automated validation first.
Use the current web and CLI tests as a fast confidence baseline before live execution, especially for paid-download auth, skill publishing, install handling, and trust routes.
Relevant suites:
- [`web/__tests__/api/skills-route.test.ts`](/Users/andy/Repos/agent-reputation-oracle/web/__tests__/api/skills-route.test.ts)
- [`web/__tests__/api/skills-raw.test.ts`](/Users/andy/Repos/agent-reputation-oracle/web/__tests__/api/skills-raw.test.ts)
- [`web/__tests__/api/skills-install.test.ts`](/Users/andy/Repos/agent-reputation-oracle/web/__tests__/api/skills-install.test.ts)
- [`web/__tests__/api/agent-trust-route.test.ts`](/Users/andy/Repos/agent-reputation-oracle/web/__tests__/api/agent-trust-route.test.ts)
- [`packages/agentvouch-cli/test/http.test.ts`](/Users/andy/Repos/agent-reputation-oracle/packages/agentvouch-cli/test/http.test.ts)
- [`packages/agentvouch-cli/test/install.test.ts`](/Users/andy/Repos/agent-reputation-oracle/packages/agentvouch-cli/test/install.test.ts)
- [`packages/agentvouch-cli/test/publish.test.ts`](/Users/andy/Repos/agent-reputation-oracle/packages/agentvouch-cli/test/publish.test.ts)
- [`packages/agentvouch-cli/test/signer.test.ts`](/Users/andy/Repos/agent-reputation-oracle/packages/agentvouch-cli/test/signer.test.ts)

3. Validate readonly live-agent flows against production/devnet-facing endpoints.
Exercise the flows an agent can perform with plain HTTP/CLI reads:
- `GET /api/skills`
- `GET /api/skills/{id}`
- `GET /api/agents/{pubkey}/trust`
- discovery endpoints such as `/api/index/skills`, `/.well-known/agentvouch.json`, and `skill.md`
Also verify `agentvouch skill list` and `agentvouch skill inspect` produce usable agent-readable output.

4. Validate live signed flows with the best-fit wallet path.
Use the available devnet-funded wallet path to test the flows that actually require signing:
- `agentvouch author register`
- `agentvouch skill install` for a paid skill, including `402` handling, purchase, signed retry, and file download
- `agentvouch skill publish` with a small devnet-safe fixture `SKILL.md`
- `agentvouch skill version add`
- optionally `agentvouch vouch create` if needed to prove the supporting trust path
Prefer CLI + local keypair for CLI-native flows; use browser/connected-wallet validation only if a browser-only step is materially different.

5. Compare actual behavior to the documented agent contract.
For each flow, report:
- whether it succeeded as documented
- whether an agent could reasonably discover and complete it
- any blockers, missing docs, CLI UX gaps, or environment assumptions
- whether the failure is code, docs, infra, auth, or on-chain state

## Output
Produce a concise flow-by-flow test report with:
- status: pass / partial / fail
- proof: command, endpoint, or test suite used
- blockers and likely fixes
- explicit note on which flows were validated live versus via automated tests only

## Verification
Run the repo’s relevant automated checks first, then the live flow commands. At minimum include:
- `npm run test:web`
- `npm run test:cli`
- any targeted build or smoke checks needed if live validation touches local app behavior

## Important Constraints
- Do not treat `reputationScore` alone as success; trust checks must consider registration and dispute status.
- For paid downloads, preserve the exact `X-AgentVouch-Auth` message contract documented in [`web/public/skill.md`](/Users/andy/Repos/agent-reputation-oracle/web/public/skill.md).
- Stop and report immediately if live execution reveals missing wallet access, unsafe spend assumptions, or unexpected production-vs-devnet mismatches.