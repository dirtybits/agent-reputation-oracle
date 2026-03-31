---
name: Unify Marketplace and Repo
overview: Consolidate the separate /skills (repo) and /marketplace pages into a single unified marketplace at /skills, using the repo's card design + trust badges with the marketplace's on-chain purchasing and activity feed sidebar.
todos:
  - id: enhance-skills-page
    content: Add activity feed sidebar, purchase buttons, My Purchases/My Listings tabs, and wallet/oracle hooks to /skills page
    status: completed
  - id: update-detail-page
    content: Remove marketplace link from skill detail page
    status: completed
  - id: redirect-marketplace
    content: Replace /marketplace page with redirect to /skills
    status: completed
  - id: update-landing
    content: Update landing page to point marketplace card to /skills, merge or simplify the two CTA cards
    status: completed
  - id: verify-build
    content: Verify TypeScript compiles and all links resolve correctly
    status: completed
isProject: false
---

# Unify Skills Repo and Marketplace

## Decision: URL `/skills`, UI label "Marketplace"

The URL stays `/skills` (matching the API at `/api/skills/*` and the agent-facing install URLs). All user-facing text says "Marketplace" — page title, nav links, landing page cards. This is trivially reversible if we want to change the URL later.

## Current State

Two separate pages serve overlapping purposes:

- `**/skills**` ([web/app/skills/page.tsx](web/app/skills/page.tsx)) — Card grid with trust badges, search, sort. Links to detail pages. No purchasing.
- `**/marketplace**` ([web/app/marketplace/page.tsx](web/app/marketplace/page.tsx)) — Tabbed UI (browse/publish/purchases/listings), on-chain purchase buttons, activity feed sidebar, revenue stats. Different card design, no trust signals.

The API already merges both data sources in [web/app/api/skills/route.ts](web/app/api/skills/route.ts).

## Target State

One page at `/skills` labeled "Marketplace" that combines:

- The repo's card design, search, sort, and trust badges (existing)
- The marketplace's activity feed sidebar (move from `/marketplace`)
- Purchase buttons on cards that have on-chain prices
- "My Purchases" and "My Listings" tabs (move from `/marketplace`)

## Changes

### 1. Enhance `/skills` page with marketplace features

**File:** [web/app/skills/page.tsx](web/app/skills/page.tsx)

- Rename all UI text from "Skill Repository" to "Marketplace"
- Add the activity feed sidebar from marketplace (the `<aside>` block, lines 488-554 of marketplace)
- Add purchase button to skill cards when `price_lamports > 0` (uses `oracle.purchaseSkill`)
- Add "My Purchases" and "My Listings" tabs (move from marketplace)
- Import `useReputationOracle` and `useWalletConnection` for purchase flow
- Add toast notifications for tx success/error (from marketplace)
- The existing search, sort, trust badges, and card grid stay as-is
- The feed loads via `oracle.getAllPurchases()` (same as marketplace does now)

### 2. Update skill detail page links

**File:** [web/app/skills/[id]/page.tsx](web/app/skills/%5Bid%5D/page.tsx)

- Remove the "This skill is also listed on the Marketplace" link pointing to `/marketplace` (line 362-363). Purchase action now lives on the unified page.

### 3. Redirect `/marketplace` to `/skills`

**File:** [web/app/marketplace/page.tsx](web/app/marketplace/page.tsx)

- Replace the entire page with a redirect to `/skills` so existing links/bookmarks don't break.

### 4. Update landing page

**File:** [web/app/page.tsx](web/app/page.tsx)

- Merge the two CTA cards ("Skill Repository" + "Skill Marketplace") into one "Marketplace" card pointing to `/skills`
- Update copy: "Browse, buy, and publish AI agent skills. Trust signals and on-chain purchasing."
- Update feature badges: replace separate "Skill Repository" and "Skill Marketplace" badges with one "Marketplace" badge

### 5. No changes needed

- **Competition page** — already links to `/skills` and `/skills/publish`
- **Publish page** — already publishes to both Postgres/IPFS and on-chain
- **API routes** — already serve merged data

## What gets preserved from marketplace

- Activity feed sidebar
- On-chain purchase flow (`handlePurchase`)
- "My Purchases" tab (purchased skills list with download links)
- "My Listings" tab (author's own listings with revenue stats)
- Toast notifications for tx success/error

## What gets removed

- `/marketplace` as a standalone page (replaced with redirect)
- The marketplace's publish tab (redundant — `/skills/publish` is better)
- The marketplace's browse tab card design (replaced by repo's card design with trust badges)
- Duplicate "View author in Skill Repo" links

## Risk

Low. The API layer already serves merged data. This is purely a UI consolidation. The on-chain purchasing logic moves into the `/skills` page unchanged.