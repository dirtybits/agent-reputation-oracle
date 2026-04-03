---
name: agentvouch-seo-plan
overview: Improve AgentVouch SEO by fixing technical discovery/indexing basics in the Next.js app, aligning page copy with the reputation-oracle positioning, and adding indexable on-domain content for high-intent search terms.
todos:
  - id: audit-metadata
    content: Add root metadataBase, title template, canonical, OG, and Twitter metadata in web/app/layout.tsx
    status: completed
  - id: add-crawl-files
    content: Add web/app/robots.ts and web/app/sitemap.ts for crawl discovery
    status: completed
  - id: route-metadata
    content: Add route-specific metadata or generateMetadata for home, docs, skills, skill detail, and author pages
    status: completed
  - id: reposition-copy
    content: Update homepage and docs copy to center AgentVouch as a reputation oracle rather than a marketplace
    status: completed
  - id: publish-content
    content: Create 2-4 indexable on-domain explainer pages from existing VISION and architecture docs
    status: completed
  - id: agent-discovery-surfaces
    content: Add agent-readable discovery surfaces such as llms.txt, a well-known manifest, and stable machine-readable indexes
    status: completed
  - id: trust-endpoints
    content: Add direct trust lookup endpoints and normalized machine-readable trust fields for agents
    status: completed
  - id: measure-results
    content: Track indexing and query performance in Google Search Console after rollout
    status: completed
isProject: false
---

# AgentVouch SEO Plan

## Current State
- The app has only one global metadata block in [`web/app/layout.tsx`](/Users/andysustic/Repos/agent-reputation-oracle/web/app/layout.tsx): title `AgentVouch` and description `On-chain reputation system for AI agents on Solana`.
- Public routes exist for `/`, `/docs`, `/skills`, `/skills/[id]`, `/author/[pubkey]`, and `/competition`, but there is no route-specific metadata.
- There is no sitemap, no robots file, no canonical metadata, no Open Graph/Twitter metadata, and no JSON-LD.
- Strong explanatory content lives in repo docs like [`README.md`](/Users/andysustic/Repos/agent-reputation-oracle/README.md), [`VISION.md`](/Users/andysustic/Repos/agent-reputation-oracle/VISION.md), and [`docs/ARCHITECTURE.md`](/Users/andysustic/Repos/agent-reputation-oracle/docs/ARCHITECTURE.md), but most of that content is not published as first-class pages on `agentvouch.xyz`.
- Agent-facing discovery exists in [`web/public/skill.md`](/Users/andysustic/Repos/agent-reputation-oracle/web/public/skill.md) and [`web/app/api/skills/route.ts`](/Users/andysustic/Repos/agent-reputation-oracle/web/app/api/skills/route.ts), but there is no dedicated machine-readable manifest, no `llms.txt`, and no direct trust lookup endpoint for agents deciding whether to trust another agent.

## Priority 1: Fix Technical SEO Basics
- Update [`web/app/layout.tsx`](/Users/andysustic/Repos/agent-reputation-oracle/web/app/layout.tsx) to add `metadataBase`, a stronger default title template, canonical `alternates`, Open Graph, Twitter card metadata, and social image defaults.
- Add [`web/app/robots.ts`](/Users/andysustic/Repos/agent-reputation-oracle/web/app/robots.ts) and [`web/app/sitemap.ts`](/Users/andysustic/Repos/agent-reputation-oracle/web/app/sitemap.ts) so crawlers can reliably discover key pages.
- Add per-route `metadata` or `generateMetadata` for:
  - [`web/app/page.tsx`](/Users/andysustic/Repos/agent-reputation-oracle/web/app/page.tsx)
  - [`web/app/docs/page.tsx`](/Users/andysustic/Repos/agent-reputation-oracle/web/app/docs/page.tsx)
  - [`web/app/skills/page.tsx`](/Users/andysustic/Repos/agent-reputation-oracle/web/app/skills/page.tsx)
  - [`web/app/skills/[id]/page.tsx`](/Users/andysustic/Repos/agent-reputation-oracle/web/app/skills/[id]/page.tsx)
  - [`web/app/author/[pubkey]/page.tsx`](/Users/andysustic/Repos/agent-reputation-oracle/web/app/author/[pubkey]/page.tsx)
- Make sure canonical URLs use `https://agentvouch.xyz` and avoid duplicate indexation from legacy `/marketplace` by keeping it as a redirect-only route.

## Priority 2: Turn Existing Pages Into Search Landing Pages
- Rework homepage copy in [`web/app/page.tsx`](/Users/andysustic/Repos/agent-reputation-oracle/web/app/page.tsx) so the H1/subhead and above-the-fold paragraph consistently target the reputation/oracle framing, not the marketplace framing.
- Tighten `/docs` in [`web/app/docs/page.tsx`](/Users/andysustic/Repos/agent-reputation-oracle/web/app/docs/page.tsx) around likely search intents such as `agent reputation oracle`, `on-chain agent reputation`, `Solana agent reputation`, `agent trust score`, and `skill.md security`.
- Add static intro copy to `/skills` and `/author/[pubkey]` that explains why those pages matter in trust terms; this gives crawlers more stable text than purely interactive client UI.
- If `skills/[id]` and `author/[pubkey]` are mostly client-rendered today, add server-rendered metadata generation from existing API/data helpers so each page has a unique title and description.

## Priority 3: Add On-Domain Content That Matches Real Queries
- Publish a small docs/content hub on the product domain using existing repo knowledge, instead of leaving core explanations only in markdown files in the repo.
- Best first pages:
  - `What is an agent reputation oracle?`
  - `How AgentVouch works: stake, vouches, disputes, and slashing`
  - `Why skill.md is a supply-chain risk for agents`
  - `How to verify an AI agent before giving it payment or access`
- Reuse material from [`VISION.md`](/Users/andysustic/Repos/agent-reputation-oracle/VISION.md) and [`docs/ARCHITECTURE.md`](/Users/andysustic/Repos/agent-reputation-oracle/docs/ARCHITECTURE.md), but rewrite it for concise, keyword-aligned web pages rather than repo docs.
- Add internal links from the homepage, `/docs`, skill pages, and author pages into these content pages.

## Priority 4: Add Structured Data
- Add JSON-LD to the homepage for the company/product layer, likely `SoftwareApplication` or `WebSite` plus `Organization`.
- Add JSON-LD to docs/content pages where it helps, especially `FAQPage` for explanatory docs.
- Add per-skill structured data only if page content is stable and accurate enough; avoid forcing generic `Product` markup if the current skill pages are thin or mostly dynamic.

## Priority 5: Measure and Iterate
- Use Google Search Console to track index coverage, query impressions, CTR, and canonical/indexing issues.
- Treat these as the first SEO success queries to earn:
  - `agent reputation oracle`
  - `on-chain reputation for ai agents`
  - `solana agent reputation`
  - `agent trust layer`
  - `skill.md security`
- Compare homepage and docs CTR before and after title/description changes, then expand into additional pages only after technical SEO and the first content cluster are working.

## Agent Discovery Track
- Add [`web/public/llms.txt`](/Users/andysustic/Repos/agent-reputation-oracle/web/public/llms.txt) and optionally `llms-full.txt` so agent crawlers have a concise machine-readable starting point that points to `/skill.md`, `/docs`, `/api/skills`, author trust semantics, and paid download rules.
- Add a stable discovery manifest such as [`web/public/.well-known/agentvouch.json`](/Users/andysustic/Repos/agent-reputation-oracle/web/public/.well-known/agentvouch.json) with:
  - canonical base URL
  - chain context
  - program id
  - discovery endpoints
  - auth and signature requirements
  - schema version
- Add direct trust lookup endpoints, likely under:
  - [`web/app/api/agents/[pubkey]/trust/route.ts`](/Users/andysustic/Repos/agent-reputation-oracle/web/app/api/agents/[pubkey]/trust/route.ts)
  - or a comparable stable path for agent-to-agent trust checks
- Normalize machine-readable trust fields across list and detail responses:
  - `canonical_agent_id`
  - `chain_context`
  - `isRegistered`
  - `activeDisputesAgainstAuthor`
  - `disputesUpheldAgainstAuthor`
  - `totalStakedFor`
  - `trust_updated_at`
  - `schema_version`
  - `recommended_action`
- Add stable JSON index feeds for agents that want bulk discovery rather than HTML crawling, for example:
  - `/api/index/skills`
  - `/api/index/authors`
  - `/api/index/trusted-authors`
- Publish an OpenAPI description for public REST routes once the response shapes are stable enough, so agents and tool builders can generate clients reliably.
- If trust results are used for higher-stakes automation, consider signed trust snapshots so downstream agents can verify that a trust summary came from AgentVouch and was not altered in transit.

## Recommended Rollout Order
1. Ship metadata, sitemap, robots, canonicals, and social cards.
2. Update homepage and docs copy to the tighter reputation-oracle positioning.
3. Add unique metadata for skill and author pages.
4. Add `llms.txt`, the well-known manifest, and at least one direct trust lookup endpoint.
5. Publish 2-4 indexable content pages from existing repo docs.
6. Add stable machine-readable indexes and normalize trust fields across public APIs.
7. Review Search Console data and agent usage patterns after indexing settles, then expand based on real queries and integration demand.

## Likely Highest-ROI Changes
- Route-specific metadata for `/`, `/docs`, `/skills/[id]`, and `/author/[pubkey]`.
- Sitemap plus robots.
- Homepage copy shift from marketplace-first to reputation-oracle-first.
- One strong explainer page targeting `agent reputation oracle` and `skill.md security`.
- `llms.txt` plus a direct `/api/agents/{pubkey}/trust` style endpoint for agent-native discovery.

## Verification
- Confirm generated page source contains the intended title, meta description, canonical, OG, and JSON-LD tags.
- Confirm `/robots.txt` and `/sitemap.xml` resolve in production.
- Confirm skill and author detail URLs emit unique titles/descriptions.
- Confirm `llms.txt` and the well-known manifest resolve in production and point at the correct canonical endpoints.
- Confirm a trust lookup endpoint returns stable machine-readable fields for a registered author, an unregistered author, and an author with dispute history.
- Submit sitemap in Search Console and inspect indexing for home, docs, one skill page, one author page, and one explainer page.