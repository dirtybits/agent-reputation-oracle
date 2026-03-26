---
name: Main merge release
overview: Define a low-risk path to merge `dev` into `main`, create a first post-hackathon release checkpoint, and add only the GitHub Actions that this repo can already support today.
todos:
  - id: verify-hosting-branch
    content: Confirm whether Vercel production is tied to `main` so the merge does not unexpectedly change production behavior.
    status: pending
  - id: define-ci-baseline
    content: "Use existing repo scripts as the initial CI baseline: root lint plus `web` lint, test, and build."
    status: pending
  - id: merge-with-pr
    content: Merge `dev` into `main` through a PR to preserve one reviewable checkpoint for the 129-commit integration.
    status: pending
  - id: tag-and-release
    content: Create a post-merge tag and GitHub Release as the first stable post-hackathon checkpoint.
    status: pending
  - id: protect-main
    content: Add branch protection after CI is in place and passing consistently.
    status: pending
isProject: false
---

# Merge `dev` Into `main`

## Recommendation

Use a small, durable process:

- Open a PR from `dev` to `main` even though the merge can fast-forward.
- Validate the current repo scripts before merging.
- Merge to `main`, then create a tag and GitHub Release on the merged commit.
- Add basic GitHub Actions now, and delay heavier release automation until the project stabilizes.

## Why This Fits This Repo

- `main` is a direct ancestor of `dev`, so the git merge itself is low-risk.
- The repo has no in-repo GitHub Actions yet, so there are no existing protections or release automations to preserve.
- Existing scripts already support a basic CI gate:
  - root: `npm run lint`
  - `web/`: `npm run lint`, `npm run test`, `npm run build`
- On-chain deployment appears manual/documented rather than branch-triggered, so GitHub Releases should be treated as source checkpoints, not chain deploy events.

## Suggested GitHub Actions

Add only these first:

- `ci.yml` on pull requests to `main` and `dev`
- Jobs:
  - root `npm ci && npm run lint`
  - `web` `npm ci && npm run lint && npm run test && npm run build`
  - optional `anchor build` if you want Solana program interface drift caught in CI
- Add branch protection on `main` once CI is green and reliable.

Do not start with:

- auto-deploy on tag
- auto-publish packages
- auto-create releases from commits

Those add process without matching current repo automation.

## Release Strategy

After merging:

- Create a tag on `main` such as `v0.1.0` or `v0.2.0`.
- Publish a GitHub Release tied to that tag.
- Use release notes to state:
  - this is the first post-hackathon `main` sync
  - what is included in the app/web state
  - whether any Solana program deployment is included or still manual

## Order Of Operations

1. Confirm what branch Vercel production tracks.
2. Run the repo checks you trust on `dev`.
3. Open PR `dev -> main`.
4. Merge.
5. Tag the merge commit.
6. Publish GitHub Release.
7. Add CI workflow and then enable branch protection.

