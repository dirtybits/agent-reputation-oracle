The core friction right now is that AgentVouch requires a Solana wallet + on-chain registration before you can do anything meaningful. That's a high bar for a first-time visitor. Here's how I'd prioritize reducing it:

---

## Tier 1 — Highest impact, low effort

**1. Mobile wallet deep links**
Firefox desktop with no extension is just one case. Mobile is worse — no extension model at all. Adding the [Phantom mobile deep link](https://docs.phantom.app/phantom-deeplinks/deeplinks-ios-and-android) (`https://phantom.app/ul/browse/{url}`) to the "no wallet" dropdown means mobile users can tap directly into Phantom's in-app browser and connect. One URL change.

**2. Read-only browsing without a wallet**
Right now `/skills` and `/marketplace` work without a wallet, which is good. But skill detail pages (`/skills/[id]`) likely show degraded states or broken UI for unauthenticated users. Auditing those pages to ensure they're fully readable without connecting would reduce bounce rate significantly.

**3. Clearer value-before-ask**
The homepage currently leads with "Connect Wallet" before showing what the platform does. Reversing this — show the skill feed, recent activity, and a few featured skills *first*, then prompt to connect when the user tries to act — follows the "value before ask" pattern that converts much better.

---

## Tier 2 — Medium effort, high payoff

**4. Social login / embedded wallet (Phantom Connect SDK)**
You already have the Phantom Connect MCP installed. This lets users sign in with Google or Apple and get an embedded wallet created automatically — no extension, no seed phrase. This is the single biggest friction reducer for non-crypto users. The skill is at `/Users/andy/.cursor/plugins/cache/cursor-public/phantom-connect/.../skills/setup-react-app/SKILL.md`.

**5. Guest publishing with deferred registration**
Let users fill out the entire publish form, *then* prompt for wallet connection + profile creation as the final step before submission. Right now the gate is at the start — users hit a wall before they've invested any effort. Inverting this (fill form → connect → register → submit) uses the sunk cost effect to increase completion rates.

**6. Skill install without purchase**
For free skills (price = 0), require only a wallet connection to "install", not a full on-chain purchase transaction. A signed message proving ownership is enough to track installs without a Solana transaction fee.

---

## Tier 3 — Larger investment, strategic

**7. Agent API key access**
Agents (not humans) are a core audience. Right now there's no way for an agent to authenticate without a wallet. Adding API key auth (generate a key after connecting once) means agents can call `/api/skills` programmatically without wallet signing on every request.

**8. Skill preview / try-before-buy**
Show the first section of a skill's content to unauthenticated users, gate the full content behind purchase/install. This gives agents and users a reason to connect.

**9. x402 micropayment integration**
You already have `docs/multi-asset-staking-and-x402-plan.md`. x402 lets agents pay for skill access per-request via HTTP headers — no wallet UI at all. This is the lowest-friction path for agent-to-agent skill consumption.

---

**My recommended order:** 1 → 3 → 2 → 4 → 5. The read-only browsing audit and value-before-ask homepage change are free wins this week. Social login via Phantom Connect is the strategic unlock for non-crypto users.

Want me to start on any of these?