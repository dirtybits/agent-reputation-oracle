---
name: monorepo-migration-plan
overview: Consolidate the repo into a single root npm workspace and lockfile while keeping the current Vercel project rooted at `web/` for the first migration phase. Remove split-install drift, preserve current deploy behavior, and leave root-based Vercel as a later optional follow-up once the workspace install path is stable.
todos:
  - id: workspace-boundaries
    content: Add `web` to the root npm workspace and convert local shared package links to `workspace:*` references.
    status: completed
  - id: lockfile-consolidation
    content: Consolidate to a single root `package-lock.json` and remove the separate `web/package-lock.json` install path.
    status: completed
  - id: script-ci-cleanup
    content: Update root scripts, CI, launch helpers, and docs to use the unified workspace install/build/test flow.
    status: completed
  - id: vercel-phase1-alignment
    content: Keep Vercel rooted at `web/`, but update and verify its install/build commands against the new workspace model.
    status: completed
  - id: migration-verification
    content: Verify clean root install, local dev/build/test, and a Vercel preview deployment before considering the migration complete.
    status: completed
isProject: false
---

# Monorepo Migration Plan

## Recommendation
- Move to a single root npm workspace and single root `package-lock.json`.
- Keep the Next app physically at `web/` for this phase.
- Keep the Vercel project deploying from `web/` during this migration.
- Defer any "Vercel builds from repo root" change until after the workspace install/build path is stable.

## Why This Shape
- The current split causes the exact failure mode we just hit: root installs and `web/` installs drift independently because both [`package.json`](/Users/andysustic/Repos/agent-reputation-oracle/package.json) and [`web/package.json`](/Users/andysustic/Repos/agent-reputation-oracle/web/package.json) act like separate npm projects.
- [`web/vercel.json`](/Users/andysustic/Repos/agent-reputation-oracle/web/vercel.json) and the current Next config already assume `web/` is the deploy root, so keeping that stable removes unnecessary deployment risk in phase 1.
- [`web/next.config.mjs`](/Users/andysustic/Repos/agent-reputation-oracle/web/next.config.mjs) already compensates for root package sharing via `turbopack.root`, so we can simplify gradually instead of moving both package management and deploy topology at once.

## Target End State For Phase 1
- Root `package.json` workspaces include both `web` and `packages/*`.
- `@agentvouch/protocol` is consumed via `workspace:*` instead of `file:../packages/agentvouch-protocol`.
- Only one lockfile remains at the repo root.
- Root install/build/test scripts are the canonical entrypoints.
- Vercel still uses `web/` as the project root, but its install/build commands are updated to work cleanly with the unified workspace model.

## Migration Steps
1. Expand the root workspace definition.
- Update [`package.json`](/Users/andysustic/Repos/agent-reputation-oracle/package.json) so workspaces include `web` alongside `packages/*`.
- Rename the `web` package if needed to a stable workspace name such as `@agentvouch/web` in [`web/package.json`](/Users/andysustic/Repos/agent-reputation-oracle/web/package.json).
- Replace current `npm --prefix web ...` helper scripts with workspace-aware equivalents once the workspace name is in place.

2. Convert local package links to workspace references.
- Change [`web/package.json`](/Users/andysustic/Repos/agent-reputation-oracle/web/package.json) from `file:../packages/agentvouch-protocol` to `workspace:*`.
- Do the same for any shared package references under [`packages/`](/Users/andysustic/Repos/agent-reputation-oracle/packages).
- Verify there are no remaining path-based package links that assume `web/` sits outside the workspace graph.

3. Consolidate lockfiles and install flow.
- Remove [`web/package-lock.json`](/Users/andysustic/Repos/agent-reputation-oracle/web/package-lock.json) after regenerating a clean root lockfile from a fresh install.
- Make root `npm install` / `npm ci` the only supported install path.
- Update documentation and internal runbooks that still say `cd web && npm ci`, especially [`README.md`](/Users/andysustic/Repos/agent-reputation-oracle/README.md), [`docs/DEPLOY.md`](/Users/andysustic/Repos/agent-reputation-oracle/docs/DEPLOY.md), and [`AGENTS.md`](/Users/andysustic/Repos/agent-reputation-oracle/AGENTS.md).

4. Normalize root scripts and CI entrypoints.
- Make root scripts the canonical interface for `dev`, `build`, `test`, and `lint` across the monorepo.
- Keep `web` scripts for local package clarity, but have CI and release steps run through root workspace commands.
- Update any launch/dev helpers that hardcode `cd web && npm run dev`, such as [`.claude/launch.json`](/Users/andysustic/Repos/agent-reputation-oracle/.claude/launch.json).

5. Keep Vercel on `web/`, but align it with the new workspace model.
- Review [`web/vercel.json`](/Users/andysustic/Repos/agent-reputation-oracle/web/vercel.json) so its install/build commands match the new single-lockfile setup.
- Verify that Vercel can still install workspace dependencies required by `web` while `web/` remains the configured project root.
- Re-check whether `turbopack.root` in [`web/next.config.mjs`](/Users/andysustic/Repos/agent-reputation-oracle/web/next.config.mjs) is still needed once the workspace graph is unified.

6. Verify before considering the migration complete.
- Run a clean root install.
- Run root lint/test/build and the `web` build path from the unified workspace.
- Verify local `next dev` startup from the new workspace model.
- Verify a Vercel preview deploy still succeeds with `web/` as the project root.

## Risks To Watch
- Vercel may still assume an install happens entirely inside `web/`; if so, workspace dependency resolution for shared packages must be tested carefully before removing the split model.
- `turbopack.root` may need adjustment once `web` joins the workspace graph.
- CI/docs drift is likely unless all `cd web && npm ci` instructions are cleaned up in the same migration.

## Optional Phase 2
- Once phase 1 is stable, evaluate switching Vercel to repo-root builds.
- At that point, consider moving shared generated client code out of `web/generated/...` into a package consumed by both `web` and CLI for a cleaner long-term shape.