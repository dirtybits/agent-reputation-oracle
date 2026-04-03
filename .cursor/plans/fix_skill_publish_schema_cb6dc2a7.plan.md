---
name: Fix skill publish schema
overview: Identify the stale schema assumption in the skill publish path and make publish self-heal the required DB shape before inserting skills. Add a focused regression test so publish does not depend on `/api/setup` having run first.
todos:
  - id: inspect-publish-bootstrap
    content: Patch the skill publish API route to initialize/migrate the DB schema before inserting a skill.
    status: completed
  - id: add-publish-regression-test
    content: Add a focused POST /api/skills test that covers schema bootstrap and successful insert flow.
    status: completed
  - id: verify-build-and-flow
    content: Run the relevant test(s), run `npm run build` in `web/`, and confirm the publish error no longer reproduces.
    status: completed
isProject: false
---

# Fix skill publish `VARCHAR(16)` failure

## What I found
- The publish UI posts directly from [`/Users/andysustic/Repos/agent-reputation-oracle/web/app/skills/publish/page.tsx`](/Users/andysustic/Repos/agent-reputation-oracle/web/app/skills/publish/page.tsx) to [`/Users/andysustic/Repos/agent-reputation-oracle/web/app/api/skills/route.ts`](/Users/andysustic/Repos/agent-reputation-oracle/web/app/api/skills/route.ts).
- That route inserts `normalizedChainContext` into `skills.chain_context`, but it does not initialize or migrate the `skills` table first.
- The only code that widens `skills.chain_context` lives in [`/Users/andysustic/Repos/agent-reputation-oracle/web/lib/db.ts`](/Users/andysustic/Repos/agent-reputation-oracle/web/lib/db.ts):

```319:410:web/app/api/skills/route.ts
const normalizedChainContext = body.chain_context
  ? normalizeInputChainContext(body.chain_context)
  : configuredSolanaChainContext;

const [skill] = await sql()<RepoSkillRow>`
  INSERT INTO skills (..., chain_context)
  VALUES (..., ${normalizedChainContext})
  RETURNING *
`;
```

```33:61:web/lib/db.ts
CREATE TABLE IF NOT EXISTS skills (
  ...
  chain_context VARCHAR(64) DEFAULT ${configuredSolanaChainContext},
  ...
)

ALTER TABLE skills
ALTER COLUMN chain_context TYPE VARCHAR(64)
```

- `initializeDatabase()` is only called from [`/Users/andysustic/Repos/agent-reputation-oracle/web/app/api/setup/route.ts`](/Users/andysustic/Repos/agent-reputation-oracle/web/app/api/setup/route.ts) and API key routes, so an older DB can still have a too-short `skills.chain_context` when publish runs.
- The local agent identity upsert also has `VARCHAR(16)` columns in [`/Users/andysustic/Repos/agent-reputation-oracle/web/lib/agentIdentity.ts`](/Users/andysustic/Repos/agent-reputation-oracle/web/lib/agentIdentity.ts), but that error path is caught and logged during publish, so it is less likely to be the user-facing failure.

## Plan
- Update [`/Users/andysustic/Repos/agent-reputation-oracle/web/app/api/skills/route.ts`](/Users/andysustic/Repos/agent-reputation-oracle/web/app/api/skills/route.ts) to call `initializeDatabase()` before the first `skills` insert so publish no longer depends on `/api/setup` having been run.
- Keep the change minimal: bootstrap the existing schema helper instead of adding a second migration path inside the route.
- Add a focused API regression test for `POST /api/skills` under [`/Users/andysustic/Repos/agent-reputation-oracle/web/__tests__`](/Users/andysustic/Repos/agent-reputation-oracle/web/__tests__) that mocks the auth/trust/IPFS dependencies and asserts the route initializes the DB before inserting.
- If test scaffolding shows the stale-schema risk could also come from agent identity bootstrap, decide whether to widen those enum-like columns now or leave them alone since they are not currently blocking publish responses.

## Verification
- Run the new focused test for `POST /api/skills`.
- Run `npm run build` in [`/Users/andysustic/Repos/agent-reputation-oracle/web`](/Users/andysustic/Repos/agent-reputation-oracle/web).
- If needed, re-test the publish page against the current DB to confirm the `value too long for type character varying(16)` error is gone.