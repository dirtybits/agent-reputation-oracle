---
name: Fix Free Skill Install
overview: Fix the install flow so legacy 0-price on-chain skills (both chain-only and repo+chain) can be installed. The install endpoint needs to handle chain-prefixed IDs, and the UI needs a gentle author nudge to set a price.
todos:
  - id: install-chain
    content: Add chain-prefix branch to install endpoint
    status: completed
  - id: author-nudge
    content: Show gentle 'set a price' note to authors of 0-price skills
    status: completed
  - id: todo-1772746691850-52pvop5nq
    content: Change minimum listing price to 0.001
    status: pending
isProject: false
---

# Fix Free Skill Install

## The Bug

`handleFreeInstall` calls `/api/skills/${id}/install` for all skills. But the [install endpoint](web/app/api/skills/[id]/install/route.ts) only handles UUID-based repo skills (`WHERE id = ${id}::uuid`). Chain-only skills (`chain-...`) cause a Postgres cast error, which surfaces as the red error in the screenshot.

## The Fix

### 1. Install endpoint: handle chain-only skills

In [web/app/api/skills/[id]/install/route.ts](web/app/api/skills/[id]/install/route.ts), add a `chain-` branch (same pattern as the GET handler in [web/app/api/skills/[id]/route.ts](web/app/api/skills/[id]/route.ts)):

```
if id starts with "chain-":
  extract pubkey from id
  call getOnChainPrice(pubkey)
  if listing exists and price > 0 -> return 402
  else -> return success (no DB row to update for chain-only skills)
else:
  existing UUID logic (unchanged)
```

Chain-only skills have no DB row, so `total_installs` tracking isn't applicable — their downloads are tracked on-chain via `totalDownloads`.

### 2. Author nudge for 0-price skills

In [web/app/skills/[id]/page.tsx](web/app/skills/[id]/page.tsx), inside the "Free Skill" banner, add a subtle note for the skill author:

- If `isOwn && skill.on_chain_address && skill.price_lamports === 0` -> show a small message like "You can set a price via Edit Listing above."
- Non-intrusive, no blocking behavior. Just awareness.

### Files changed

- `web/app/api/skills/[id]/install/route.ts` — add chain-prefix branch
- `web/app/skills/[id]/page.tsx` — author nudge in free skill banner
