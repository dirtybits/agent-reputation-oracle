---
name: Main merge release
overview: Define a low-risk path to merge `dev` into `main`, cut `agentvouch.xyz` over to the validated `main` production deployment, and create `v0.1.0` as the first stable post-hackathon GitHub release checkpoint.
todos:
  - id: verify-domain-cutover-state
    content: Confirm where `agentvouch.xyz` currently resolves, record the rollback target, and verify the `agentvouch` project still uses `main` as its production branch.
    status: in_progress
  - id: define-ci-baseline
    content: "Use existing repo scripts as the initial CI baseline: root lint plus `web` lint, test, and build."
    status: in_progress
  - id: merge-with-pr
    content: Merge `dev` into `main` through a PR to preserve one reviewable checkpoint for the 129-commit integration.
    status: pending
  - id: verify-main-production
    content: Verify the `main` production deployment on Vercel is healthy before moving the custom domain.
    status: pending
  - id: cutover-custom-domain
    content: Move `agentvouch.xyz` onto the `main` production deployment, smoke test it, and keep the previous live deployment ready for rollback.
    status: pending
  - id: tag-and-release
    content: Create `v0.1.0` and a GitHub Release after `agentvouch.xyz` is serving the validated `main` deployment.
    status: pending
  - id: protect-main
    content: Add branch protection after CI is in place and passing consistently.
    status: pending
isProject: false
---

# Merge `dev` Into `main`

## Current Hosting Model

- `main` is already the Vercel production branch for the `agentvouch` project.
- `agentvouch.vercel.app` reflects `main`.
- `agentvouch.xyz` still needs to be moved from the current dev-driven deployment onto the validated `main` production deployment.
- The release is therefore a domain cutover plan, not a production-branch switch plan.

## Goal

Ship one clean checkpoint where:

- `dev` is merged into `main`
- the resulting `main` production deployment is verified on Vercel
- `agentvouch.xyz` serves that `main` deployment
- `v0.1.0` marks the first stable post-hackathon GitHub release

## How Manual Is This?

Almost all of it can be done from the command line:

- `git`: inspect history, switch branches, tag, and push
- `gh`: open the PR, merge it, and create the GitHub Release
- `vercel`: inspect linked project info, deployments, logs, and domain assignment state

The only truly manual parts are:

- reading the PR diff before you merge
- moving `agentvouch.xyz` if the exact alias/domain action is clearer in the dashboard than the CLI
- deciding when to enable branch protection

## Manual CLI Runbook

### 1. Confirm Current Branch State

Run these from the repo root:

```bash
git fetch origin
git status
git branch --show-current
git rev-list --left-right --count main...dev
git log --oneline --decorate --graph main..dev -20
git tag --list
```

What you are looking for:

- `dev` is clean
- `main...dev` shows `0 129` or similar, meaning `main` has no unique commits
- existing tags are minimal, so `v0.1.0` is a clean first stable release marker

### 2. Capture The Current Domain State And Rollback Target

Check the linked project and current deploy state first:

Try:

```bash
vercel whoami
vercel project inspect agentvouch
vercel list
```

Useful follow-ups if needed:

```bash
vercel inspect <deployment-url-or-id>
vercel logs <deployment-url-or-id>
```

Goal:

- confirm the project is `agentvouch`
- confirm production branch remains `main`
- record the current live deployment behind `agentvouch.xyz` before any cutover
- record the current `main` production deployment URL so you know exactly what you intend to promote

If the CLI output is unclear, confirm once in the Vercel dashboard:

- `Settings -> Git -> Production Branch` is `main`
- `Settings -> General -> Root Directory` still points at `web/`
- `Domains -> agentvouch.xyz` shows where the apex currently routes

Do not cut over the domain until you have the current live deployment URL written down as the rollback target.

### 3. Run Pre-Merge Checks On `dev`

From the repo root:

```bash
npm ci
npm run lint
```

From `web/`:

```bash
cd web
npm ci
npm run lint
npm run test
npm run build
cd ..
```

If the Anchor program or IDL changed:

```bash
anchor build
```

If `anchor build` changes generated files, refresh the web artifacts before validating the web deployment:

```bash
cp target/idl/reputation_oracle.json web/reputation_oracle.json
cd web
npx tsx ./scripts/generate-client.ts
npm run build
cd ..
```

Review those generated changes before merging.

### 4. Open A PR From `dev` To `main`

Push `dev` first if needed:

```bash
git checkout dev
git push origin dev
```

Create the PR:

```bash
gh pr create --base main --head dev --title "Merge dev into main" --body "Post-hackathon merge of the long-lived dev branch into main. This establishes main as the current baseline and keeps the release history explicit."
```

Then inspect it:

```bash
gh pr view --web
```

This is where the human review happens. Since the merge is large, skim the files changed and the commit range before merging.

### 5. Merge The PR And Sync Local `main`

If you want to preserve the branch history as-is and `main` is strictly behind `dev`, use:

```bash
gh pr merge --merge --delete-branch=false
```

If GitHub allows a fast-forward style update through the UI and you prefer that, that is also fine. I would avoid squash here because this branch represents several weeks of work.

Then sync local `main`:

```bash
git checkout main
git pull origin main
```

### 6. Verify The `main` Production Deployment

After the merge, let Vercel build the production deployment for `main`, then inspect it before touching the custom domain.

Useful checks:

```bash
vercel list
vercel inspect https://agentvouch.vercel.app
```

What you are looking for:

- the deployment is from `main`
- the build is green
- the app root is still `web/`
- expected production env vars are present
- the app loads correctly at the production deployment URL before cutover

### 7. Move `agentvouch.xyz` To The Validated `main` Deployment

Once the `main` production deployment is healthy, move or confirm `agentvouch.xyz` on that deployment.

Verify:

- `agentvouch.xyz` is attached to the `agentvouch` project production deployment
- apex and `www` behavior is intentional
- callback URLs, webhooks, and canonical site URL settings point at `https://agentvouch.xyz`

Smoke test immediately after cutover:

- homepage loads on `https://agentvouch.xyz`
- `/dashboard`, `/docs`, and `/skills` load
- wallet/connect flow renders correctly
- theme toggle and primary nav actions still display correctly
- at least one API-backed page or interaction works
- browser console shows no obvious production-breaking errors

Useful manual checks:

```bash
curl -I https://agentvouch.xyz
curl -I https://www.agentvouch.xyz
vercel inspect https://agentvouch.vercel.app
```

### 8. Roll Back Fast If The Domain Cutover Fails

If anything looks wrong after `agentvouch.xyz` moves:

- restore the domain or alias to the previously recorded live deployment first
- inspect the latest production deployment in Vercel
- compare production env vars against local expectations
- confirm the deployed commit is from `main`
- only continue with release tagging once the live domain is healthy

### 9. Tag The Merged Commit

Default release tag:

- `v0.1.0` as the first stable post-hackathon baseline after live-domain cutover

Create and push it:

```bash
git tag -a v0.1.0 -m "First post-hackathon main release"
git push origin v0.1.0
```

### 10. Create The GitHub Release

Create release notes manually:

```bash
gh release create v0.1.0 --title "v0.1.0" --notes "First stable post-hackathon release. Merges the long-lived dev branch into main, validates the main production deployment, and cuts agentvouch.xyz over to that deployment. Solana program deployment remains a separate tracked operation unless explicitly included."
```

If you want GitHub to draft notes from commits:

```bash
gh release create v0.1.0 --title "v0.1.0" --generate-notes
```

I would still edit the notes after generation so they clearly state whether an on-chain deploy is included.

## Should You Add GitHub Actions?

Yes, but only a basic CI workflow first.

Add one workflow that runs on pull requests to `main` and `dev`:

- root `npm ci && npm run lint`
- `web` `npm ci && npm run lint && npm run test && npm run build`
- optional `anchor build` when program or IDL changes are in scope

Do not start with:

- auto-release on tag
- auto-deploy on merge
- auto-publish packages

This repo does not currently have a release automation pattern, so start by protecting code quality, not by automating deployments.

## After Release Stabilizes

Once the workflow is reliable, enable branch protection on `main`:

- require PRs
- require the CI check to pass
- optionally require up-to-date branches before merge

## Vercel Production Checklist

Verify these in the `agentvouch` Vercel project:

- `Settings -> Git -> Production Branch` is set to `main`
- `agentvouch.vercel.app` reflects the current `main` production deployment
- `Domains -> agentvouch.xyz` is attached to the same production deployment after cutover
- if you use `www.agentvouch.xyz`, decide whether `www` redirects to apex or apex redirects to `www`
- project build settings still point at the correct app root: `web/`
- Production environment variables exist and match what the app expects
- callback URLs, webhook URLs, wallet/auth URLs, and any canonical site URL settings point at `https://agentvouch.xyz`

Recommended order:

1. Merge `dev` into `main`.
2. Confirm the `main` production deployment is healthy.
3. Move `agentvouch.xyz` onto that deployment.
4. Smoke test the live domain after deploy.
5. Tag `v0.1.0`.
6. Create the GitHub release.

Main risk areas during cutover:

- missing production env vars
- stale callback or webhook URLs pointing at preview or `vercel.app` domains
- project root/build settings targeting the wrong directory
- not capturing the previous live deployment URL for rollback
- accidental live deploys from future direct pushes to `main` before branch protection is added

## Post-Deploy Smoke Test

After `main` is live on `https://agentvouch.xyz`, verify the basics:

- homepage loads on `https://agentvouch.xyz`
- no obvious runtime error screen or broken styling
- primary navigation loads expected pages such as `/dashboard`, `/docs`, and `/skills`
- wallet/connect flow renders correctly
- theme toggle and main nav actions still display correctly
- at least one API-backed page or interaction works
- browser console does not show obvious production-breaking errors
- canonical URLs and redirects behave as expected for apex and `www` if both are configured

Useful manual checks:

```bash
curl -I https://agentvouch.xyz
curl -I https://www.agentvouch.xyz
vercel list
vercel inspect https://agentvouch.vercel.app
```

## Recommended Order

1. Confirm current domain routing and record rollback target.
2. Run lint, test, and build on `dev`.
3. Open PR `dev -> main` with `gh`.
4. Review PR.
5. Merge PR.
6. Verify the `main` production deployment.
7. Move `agentvouch.xyz` to that deployment.
8. Smoke test the live domain.
9. Tag `v0.1.0`.
10. Create the GitHub release.
11. Add CI workflow.
12. Turn on branch protection.

