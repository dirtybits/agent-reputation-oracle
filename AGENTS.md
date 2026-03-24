## Learned User Preferences

- Start with a plan for non-trivial work and re-plan when scope or evidence changes; when the user provides a plan document, follow it as written, avoid editing it unless asked, and do not recreate existing todos.
- Use subagents liberally for focused research, exploration, and parallel analysis.
- Verify work before calling it done with concrete proof such as type checks, tests, logs, or behavior diffs.
- Run `npm run build` after substantive code changes before considering the task complete; if the change is docs-only or otherwise build-irrelevant, explicitly note that the build was skipped.
- Use `npm` as the preferred package manager; avoid introducing conflicting lockfiles.
- Favor root-cause fixes and minimal-impact changes over temporary patches.
- Keep responses direct and concise; avoid buzzwords and marketing language.
- For decks, CFPs, and synopsis copy, keep claims tightly aligned to the implemented system; prefer tighter, defensible wording and label unfinished pieces as `WIP` instead of implying they are already shipped.
- For social media and outbound messages, focus on substance, numbers, and agent incentives; structure around what is being announced and why people should care. For vouch-related copy, emphasize upside and revenue share over loss framing.
- Think through the solution before making code changes.

## Learned Workspace Facts

- `web/` is the Next.js app and `programs/reputation-oracle/` is the on-chain Solana program.
- Use CAIP-2 as the canonical stored chain/network label format across docs and schema design; treat `solana`, `solana:mainnet`, and `solana:mainnet-beta` as legacy aliases only, and preserve non-CAIP upstream labels separately.
- Trust signals are core to the product and should stay prominent across skill discovery and detail surfaces.
- Prefer a tighter, sharper UI aesthetic with compact spacing and `rounded-md` corners over softer SaaS-style radii, especially on compact action cards.
- Keep `/skills` and `/api/skills/*` as the canonical skill routes, use `Marketplace` as the user-facing label, and treat `/marketplace` as a legacy redirect.
- The UI accent palette uses lobster-orange primary actions with muted sea-blue secondary accents; keep it tasteful and aligned with the lobster reference image and favicon.
- Recent purchase activity is important social proof on skill browsing surfaces and should stay visible when marketplace/repo views are consolidated.
- The landing page uses a Moltbook-style inline Human/Agent toggle, while deeper flows live at `/dashboard` and `/docs`.
- Public author pages live at `/author/[pubkey]`, and author identifiers on skill surfaces should link there. Author vouching should happen there too, with inline registration when needed so users stay in the flow.
- Use `Report` for end-user issue actions, `Dispute` for protocol/admin objects, and keep `Vouch` reserved for external endorsement only; future self-stake should be modeled as `AuthorBond` / `SelfStake`, not self-vouch.
- `https://agentvouch.xyz` is the canonical public base URL for agent-facing install and docs flows.
- `web/public/skill.md` is the canonical served agent-facing skill file
