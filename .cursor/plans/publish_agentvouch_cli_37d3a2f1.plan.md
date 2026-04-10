---
name: Publish AgentVouch CLI
overview: Make both `@agentvouch/cli` and `@agentvouch/protocol` publish-ready as public npm packages, add hardened release safeguards, and align docs/install guidance around the new public CLI release.
todos:
  - id: package-publish-readiness
    content: Make `@agentvouch/cli` and `@agentvouch/protocol` public-package ready with metadata, access settings, files allowlists, and license alignment
    status: pending
  - id: release-hardening
    content: Add publish guards and a repeatable protocol-first release flow with local pack verification
    status: pending
  - id: docs-align-install-story
    content: Align README, package READMEs, and public install docs around the new public CLI release
    status: pending
  - id: publish-verify
    content: Validate tarballs and document the first publish sequence plus post-publish install verification
    status: pending
isProject: false
---

# Publish AgentVouch CLI

## Goal
Ship a hardened first public npm release for both `@agentvouch/cli` and `@agentvouch/protocol`, with a reliable install path, stable publish surface, and docs that stop contradicting each other.

## Recommended Packaging Strategy
- Publish both packages, with `@agentvouch/protocol` released first and `@agentvouch/cli` depending on that published version.
- Keep the protocol package minimal for v0.1: publish its existing runtime/type files from `src/` instead of adding a new build step.
- Treat the CLI as the official automation client for AgentVouch, not a second product surface.

## Phase 1: Make Both Packages Publishable
- Update [packages/agentvouch-cli/package.json](packages/agentvouch-cli/package.json) and [packages/agentvouch-protocol/package.json](packages/agentvouch-protocol/package.json):
  - remove `private: true`
  - add `publishConfig.access: public`
  - add `description`, `license`, `repository`, `homepage`, `bugs`, `keywords`
  - add a constrained `files` allowlist so npm tarballs contain only intended release assets
- For the CLI package, make sure the `files` list includes `dist/` because the binary at `bin.agentvouch` points to `dist/cli.js` and root `.gitignore` currently ignores `dist`.
- For the protocol package, explicitly ship only the current public surface (`src/index.js`, `src/index.d.ts`, and any required metadata/docs) so consumers do not get accidental workspace junk.
- Add a repo-level `LICENSE` file and keep package `license` fields consistent with it.

## Phase 2: Add Release Hardening
- Add publish guards to [packages/agentvouch-cli/package.json](packages/agentvouch-cli/package.json) and, if useful, [packages/agentvouch-protocol/package.json](packages/agentvouch-protocol/package.json):
  - `prepublishOnly` to run the required build/test checks
  - explicit pack verification via `npm pack` before live publish
- Add a small release script or documented sequence at the root [package.json](package.json) for:
  - building CLI
  - packing protocol
  - packing CLI
  - publishing protocol first, then CLI
- Verify that the CLI’s dependency on `@agentvouch/protocol` uses the intended registry version rather than relying on workspace linking.

## Phase 3: Align Docs and Install Story
- Update [README.md](README.md) so the CLI section stops saying the package is repo-local only once npm publishing is enabled.
- Add package-level READMEs for [packages/agentvouch-cli/package.json](packages/agentvouch-cli/package.json) and [packages/agentvouch-protocol/package.json](packages/agentvouch-protocol/package.json) so npm pages are usable on first release.
- Reconcile the public install guidance already implied in [web/public/skill.md](web/public/skill.md) with the repo docs so `npx`/global install/examples all tell the same story.

## Phase 4: Release Process and Verification
- Validate local tarballs before publish:
  - `npm run test:cli`
  - `npm run build:cli`
  - `npm pack --workspace @agentvouch/protocol`
  - `npm pack --workspace @agentvouch/cli`
- Inspect the tarballs to confirm:
  - CLI tarball includes `dist/cli.js`
  - protocol tarball includes the files referenced by `exports`
  - no unwanted tests/maps/workspace artifacts ship unless intentionally included
- Perform first publish in order:
  - publish `@agentvouch/protocol`
  - publish `@agentvouch/cli`
  - verify `npm install -g @agentvouch/cli` and `agentvouch --help`

## Key Files
- [packages/agentvouch-cli/package.json](packages/agentvouch-cli/package.json)
- [packages/agentvouch-protocol/package.json](packages/agentvouch-protocol/package.json)
- [package.json](package.json)
- [README.md](README.md)
- [web/public/skill.md](web/public/skill.md)

## Risks To Watch
- Publishing `@agentvouch/cli` before `@agentvouch/protocol` will break installs.
- Missing `files` allowlists can produce broken tarballs, especially for the ignored CLI `dist/` output.
- Public release raises the bar for output stability; JSON and text output changes should be treated as deliberate interface changes after launch.