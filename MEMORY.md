# MEMORY.md - Long-Term Memory

## Who I Am
- **Name:** Sparky ⚡
- **Nature:** AI assistant running on OpenClaw
- **Vibe:** Direct, resourceful, no fluff
- **Created:** February 6, 2026

## Who I Work With
- **Human:** Oddbox
- **How to address:** Oddbox
- **Twitter:** @oddboxmusic, @dirtybits
- **Timezone:** PST (America/Los_Angeles)
- **Domain:** Cryptocurrency/web3/blockchain/decentralized systems developer
- **Primary blockchain:** Solana

## Active Projects

### Colosseum Agent Hackathon (Feb 2-12, 2026)
- **Status:** SUBMITTED ✅ (Feb 11, 21:41 PST)
- **Project:** Agent Reputation Oracle (ID 664)
- **Public URL:** https://colosseum.com/agent-hackathon/projects/agent-reputation-oracle
- **Prize pool:** $100k USDC
- **Deadline:** Feb 13, 2026 17:00 UTC
- **Agent name:** OddSparky
- **Credentials:** `~/.config/colosseum/credentials.json`

### Agent Reputation Oracle (Hackathon Project) ✅ SUBMITTED
**What it is:** On-chain reputation system where agents stake SOL to vouch for each other. Bad vouches get slashed when disputes arise. Provides trust layer for agent marketplaces/collaborations.

**Why this:** Novel infrastructure play that's composable with existing agent economy projects. Tight scope, shippable in 6 days.

**VALIDATION:** [Moltbook post by eudaemon_0](https://www.moltbook.com/post/cbd6474f-8478-4894-95f1-7b104a73bcd5) - "The supply chain attack nobody is talking about: skill.md is an unsigned binary" (4.5k upvotes, 109k comments). Community consensus: skill.md supply chain attacks are critical threat. Post specifically proposes "isnad chains" (Islamic hadith authentication model for provenance) which our vouch system implements.

**Tech:** Solana/Anchor smart contracts, AgentWallet integration, web UI, public query API.

**Isnad chains:** Our vouch system implements the Islamic hadith authentication model (provenance chains) that the Moltbook security community identified as the right solution.

**Brand:** AgentVouch (rebranded Feb 12, 2026 14:46 PST) - clear, professional, emphasizes agent vouching system.

**Shipped:**
- Smart contract: `EDtweyEKbbesS4YbumnbdQeNr3aqdvUF9Df4g9wuuVoj` (devnet)
- Web UI: https://agentvouch.vercel.app/
- GitHub: https://github.com/dirtybits/agent-reputation-oracle
- Hackathon: https://colosseum.com/agent-hackathon/projects/agent-reputation-oracle
- Submitted: Feb 11, 2026 21:41 PST

## Social Presence
- **Moltbook:** OddSparky (https://moltbook.com/u/OddSparky)
  - Profile: "AI assistant to Oddbox. Direct, resourceful, no fluff. ⚡"
  - Credentials: `~/.config/moltbook/credentials.json`
  - First post: Intro asking about vibe/culture
  - Learning: Watch out for casino spam bots, be selective about engagement

## Important Decisions
- Chose Agent Reputation Oracle over: game ideas, DeFi rebalancer, collaboration protocol, bounty board
- Reasoning: Novel, tight scope, composable, clear utility
- Oddbox leaning toward novel infrastructure vs crowded spaces

## Lessons Learned
- **Write everything down** — "mental notes" don't survive session restarts
- **Security awareness** — spam/scams exist in agent social networks
- **Scope matters** — 6 days is tight, focused project beats ambitious vaporware
- **Agent ecosystem is active** — lots of marketplaces, payment rails, DeFi bots in hackathon
- **"Potentially destructive" actions require permission** (Feb 10, 2026) — Created test issue on GitHub repo during token testing without explicit warning. Even for security testing, external write actions (creating issues, PRs, comments) should be announced upfront or permission requested first. Updated AGENTS.md with clearer guidance.
- **Vercel team deployments** (Feb 11, 2026) — When deploying to a team account: (1) Run `vercel teams list` to get the exact team ID, (2) Remove `.vercel/` directory if project is linked to wrong account, (3) Use `vercel --scope <team-id> --yes` to deploy to correct team. Team ID format is like `dirtybitsofficials-projects`, not the display name.
- **Directory structure matters for deployments** (Feb 12, 2026) — Discovered nested directory confusion in agent-reputation-oracle project. When Vercel deployments fail with "● Error", check: (1) Actual GitHub repo structure vs local workspace structure, (2) Vercel root directory configuration matches repo layout, (3) Build logs for path-related errors. Git integration auto-deploys are convenient but need correct root directory config.

## To Remember
- Oddbox values novel ideas over repetitive implementations
- Be wary of marketing-y language even from other agents
- When unsure about scams/security, ask Oddbox
- File everything properly — credentials in `~/.config/`, daily logs in `memory/YYYY-MM-DD.md`

## Agent Testing Wallets

### Sparky's Agent Address
- **Address:** `DRu2fqNcrieKtaAox2cFQSers1HJTyPj5ggv8nsryZxJ`
- **Keypair:** `~/.openclaw/workspace/.agent-keys/sparky-keypair.json`
- **Network:** Solana Devnet
- **Purpose:** Testing reputation oracle & marketplace

### Deployed Program
- **Program ID:** `ELmVnLSNuwNca4PfPqeqNowoUF8aDdtfto3rF9d89wf`
- **Network:** Solana Devnet
- **Config Initialized:** Feb 11, 2026 (min stake: 0.01 SOL, slash: 50%)

