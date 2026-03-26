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

## How Manual Is This?

Almost all of it can be done from the command line:

- `git`: inspect history, switch branches, tag, and push
- `gh`: open the PR, merge it, and create the GitHub Release
- `vercel`: inspect linked project info, deployments, and logs

The only truly manual parts are:

- deciding the release tag name
- reading the PR diff before you merge
- confirming whether Vercel production is tied to `main`
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
- existing tags are minimal, so you can introduce a first post-hackathon release tag cleanly

### 2. Check What Vercel Production Uses

This is the one step that may be partly dashboard-driven if the local repo is not linked yet.

Try:

```bash
vercel whoami
vercel link
vercel project ls
vercel list
```

Useful follow-ups if needed:

```bash
vercel inspect <deployment-url-or-id>
vercel logs <deployment-url-or-id>
```

Goal:

- confirm which project this repo is linked to
- confirm whether production deploys are tied to `main`

If the CLI output is unclear, check the Vercel dashboard Git settings once before merging.

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

Optional if the Anchor program or IDL changed:

```bash
anchor build
```

If `anchor build` changes generated files, review those before merging.

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

### 5. Merge The PR

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

### 6. Tag The Merged Commit

Pick one tag. Reasonable choices:

- `v0.1.0` if this is the first real release baseline
- `v0.2.0` if you consider the hackathon submission the earlier baseline

Create and push it:

```bash
git tag -a v0.1.0 -m "First post-hackathon main release"
git push origin v0.1.0
```

### 7. Create The GitHub Release

Create release notes manually:

```bash
gh release create v0.1.0 --title "v0.1.0" --notes "First post-hackathon main release. Merges the long-lived dev branch into main and establishes the new default baseline. Web changes are included in this source release. Solana program deployment remains a separate manual operation unless explicitly redeployed."
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
- optional `anchor build`

Do not start with:

- auto-release on tag
- auto-deploy on merge
- auto-publish packages

This repo does not currently have a release automation pattern, so start by protecting code quality, not by automating deployments.

## After CI Exists

Once the workflow is reliable, enable branch protection on `main`:

- require PRs
- require the CI check to pass
- optionally require up-to-date branches before merge

## Vercel Production Checklist

If you want `main` to power `agentvouch.xyz`, verify these in the `agentvouch` Vercel project:

- `Settings -> Git -> Production Branch` is set to `main`
- `Domains -> agentvouch.xyz` is attached to the `agentvouch` project
- if you use `www.agentvouch.xyz`, decide whether `www` redirects to apex or apex redirects to `www`
- project build settings still point at the correct app root, likely `web/`
- Production environment variables exist and match what the app expects
- callback URLs, webhook URLs, wallet/auth URLs, and any canonical site URL settings point at `https://agentvouch.xyz`

Recommended order:

1. Merge `dev` into `main`.
2. Confirm `main` passes lint, test, and build.
3. Update the Vercel production branch to `main`.
4. Verify `agentvouch.xyz` is assigned to the `agentvouch` project.
5. Trigger or confirm a production deploy from `main`.
6. Smoke test the live domain after deploy.

Main risk areas when switching production to `main`:

- missing production env vars
- stale callback or webhook URLs pointing at preview or `vercel.app` domains
- project root/build settings targeting the wrong directory
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

If anything looks wrong after the switch:

- inspect the latest production deployment in Vercel
- compare production env vars against local expectations
- confirm the deployed commit is from `main`
- roll back to the prior production deployment if needed

## Recommended Order

1. Confirm Vercel production branch.
2. Run lint, test, and build on `dev`.
3. Open PR `dev -> main` with `gh`.
4. Review PR.
5. Merge PR.
6. Tag `main`.
7. Create GitHub Release.
8. Add CI workflow.
9. Turn on branch protection.

