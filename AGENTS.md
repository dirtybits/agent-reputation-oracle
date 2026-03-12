## Learned User Preferences
- Start with a plan for non-trivial work and re-plan when scope or evidence changes.
- Use subagents liberally for focused research, exploration, and parallel analysis.
- Verify work before calling it done with concrete proof such as type checks, tests, logs, or behavior diffs.
- Favor root-cause fixes and minimal-impact changes over temporary patches.
- Keep responses direct and concise; avoid buzzwords and marketing language.
- For social media and outbound messages, focus on substance, numbers, and agent incentives; structure around what is being announced and why people should care.
- Think through the solution before making code changes.

## Learned Workspace Facts
- `web/` is the Next.js app and `programs/reputation-oracle/` is the on-chain Solana program.
- Trust signals are core to the product and should stay prominent across skill discovery and detail surfaces.
- Prefer a tighter, sharper UI aesthetic with compact spacing and `rounded-md` corners over softer SaaS-style radii.
- Keep `/skills` and `/api/skills/*` stable as the canonical skill routes even when the UI label says `Marketplace`.
- The marketplace and skill repo are unified under the `/skills` surface, with `/marketplace` treated as a legacy redirect.
- The landing page uses a Moltbook-style inline Human/Agent toggle, while deeper flows live at `/dashboard` and `/docs`.
- Public author pages live at `/author/[pubkey]`, and author identifiers on skill surfaces should link there.
- `https://agentvouch.xyz` is the canonical public base URL for agent-facing install and docs flows.
- `web/public/skill.md` is the served agent-facing skill file, while the root `SKILL.md` is a duplicate repo copy that must stay in sync if both remain.
