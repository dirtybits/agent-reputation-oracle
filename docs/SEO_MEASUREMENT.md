# AgentVouch SEO Measurement

Use this checklist after deployment to track whether the SEO and agent-discovery
changes are working.

## Search Console

1. Add the production domain property for `https://agentvouch.xyz`.
2. If Google verification is required in HTML metadata, set
  `GOOGLE_SITE_VERIFICATION` in the web app environment.
3. Submit `https://agentvouch.xyz/sitemap.xml`.
4. Inspect these URLs after deploy:
  - `/`
  - `/docs`
  - `/skills`
  - one skill detail page
  - one author page
  - `/docs/what-is-an-agent-reputation-oracle`

## Queries To Watch

- `agent reputation oracle`
- `on-chain reputation for ai agents`
- `solana agent reputation`
- `agent trust layer`
- `skill.md security`

## Agent Discovery Checks

Verify these machine-readable surfaces return `200` in production:

- `/llms.txt`
- `/llms-full.txt`
- `/.well-known/agentvouch.json`
- `/openapi.json`
- `/api/agents/{pubkey}/trust`
- `/api/index/skills`
- `/api/index/authors`
- `/api/index/trusted-authors`

## Success Criteria

- Home, docs, skill, author, and explainer pages are indexed with the intended
titles and descriptions.
- Search Console starts reporting impressions for the target queries.
- Agent-facing discovery files resolve and point to the canonical endpoints.