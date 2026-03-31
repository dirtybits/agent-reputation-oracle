---
name: author-vouch-flow
overview: Keep vouching under the existing AgentProfile model, surface the author-page CTA for all viewers, and guide users through connect and registration before vouching.
todos:
  - id: author-page-state-flow
    content: Update the author page to show the vouch CTA for disconnected, unregistered, and registered viewers with the right guided next step
    status: completed
  - id: registration-reuse
    content: Reuse the existing AgentProfile registration flow from the web app so users can register from the author page before vouching
    status: completed
  - id: trust-badge-icon
    content: Add the $ icon above the SOL Staked label in the shared TrustBadge component
    status: completed
  - id: verify-build
    content: Run npm build, then do a quick author-page smoke check for disconnected, unregistered, and registered viewers
    status: completed
isProject: false
---

# Enable Author Vouching From Profile

## Recommendation

Keep the current `AgentProfile` requirement and do not change the on-chain protocol. Instead, update the author page so the vouch card is always visible on non-self profiles and guides the viewer through the required steps:

1. disconnected: connect wallet
2. connected but unregistered: register AgentProfile
3. connected and registered: enter stake amount and vouch

This is the simplest path and keeps all vouching logic under the existing `AgentProfile` model.

Use the existing publish flow as the UX precedent: keep the main task visible, only gate when the user commits to the action, and resume the original action after registration succeeds.

## Why this is needed

The current author page already has a vouch card, but it is hidden unless the viewer already has an on-chain profile:

- [web/app/author/[pubkey]/page.tsx](/Users/andysustic/Repos/agent-reputation-oracle/web/app/author/[pubkey]/page.tsx)
- Current gate: `connected && myProfile && !isOwnProfile`

The current on-chain model already makes `AgentProfile` the identity for vouchers, so the frontend should guide users into that existing path instead of changing protocol behavior:

- [programs/reputation-oracle/src/instructions/vouch.rs](/Users/andysustic/Repos/agent-reputation-oracle/programs/reputation-oracle/src/instructions/vouch.rs)
- [programs/reputation-oracle/src/instructions/register_agent.rs](/Users/andysustic/Repos/agent-reputation-oracle/programs/reputation-oracle/src/instructions/register_agent.rs)
- [programs/reputation-oracle/src/state/vouch.rs](/Users/andysustic/Repos/agent-reputation-oracle/programs/reputation-oracle/src/state/vouch.rs)

Essential current constraint:

```8:24:programs/reputation-oracle/src/instructions/vouch.rs
pub struct CreateVouch<'info> {
    #[account(
        init,
        payer = voucher,
        space = Vouch::LEN,
        seeds = [b"vouch", voucher_profile.key().as_ref(), vouchee_profile.key().as_ref()],
        bump
    )]
    pub vouch: Account<'info, Vouch>,

    #[account(
        mut,
        seeds = [b"agent", voucher.key().as_ref()],
        bump = voucher_profile.bump
    )]
    pub voucher_profile: Account<'info, AgentProfile>,
```

## Implementation plan

1. Mirror the publish-flow registration pattern on the author page.

- Use [web/app/skills/publish/page.tsx](/Users/andysustic/Repos/agent-reputation-oracle/web/app/skills/publish/page.tsx) as the UX reference.
- Keep the main author page visible and do not redirect users away from `/author/[pubkey]`.
- Gate only when the user tries to vouch, not at page load.
- Preserve intent with a pending-action flag so registration can automatically resume the vouch flow after success.
- Reuse the publish pattern of polling for a readable `AgentProfile` after registration before unlocking the next step.

1. Update the author page CTA to support all viewer states.

- File: [web/app/author/[pubkey]/page.tsx](/Users/andysustic/Repos/agent-reputation-oracle/web/app/author/[pubkey]/page.tsx)
- Remove the hard dependency on `myProfile` for rendering the card.
- Keep self-profile suppression.
- Show a clear vouch CTA even when disconnected, with copy that explains the next step.
- For disconnected users, prompt wallet connection without losing page context.
- For connected but unregistered users, open an inline registration gate modeled after publish.
- For connected and registered users, show the stake input and submit action.
- Keep the flow compact and direct for agents who are intentionally vouching for trusted authors.

1. Reuse the existing registration flow on the author page.

- Files:
  - [web/app/author/[pubkey]/page.tsx](/Users/andysustic/Repos/agent-reputation-oracle/web/app/author/[pubkey]/page.tsx)
  - [web/app/dashboard/page.tsx](/Users/andysustic/Repos/agent-reputation-oracle/web/app/dashboard/page.tsx)
  - [web/components/ClientWalletButton.tsx](/Users/andysustic/Repos/agent-reputation-oracle/web/components/ClientWalletButton.tsx)
- Reuse existing wallet-connect UI instead of inventing a new connect pattern.
- Reuse the existing `registerAgent` flow so the author page can walk the user through registration inline.
- After registration succeeds, refresh local state and reveal or resume the vouch form automatically.
- Reuse the publish-flow status handling where possible:
  - waiting for wallet confirmation
  - finalizing registration
  - already exists recovery
  - auto-continue after success

1. Tune the copy for both human and agent vouching.

- Keep the message focused on trust and momentum: this is a one-time setup before vouching for an author you trust.
- Make the registration gate explain why the profile is required, without making it feel like a detour.
- Avoid hiding the path behind dashboard-only knowledge; the author page should stand on its own.

1. Add the requested `$` icon above `SOL Staked`.

- File: [web/components/TrustBadge.tsx](/Users/andysustic/Repos/agent-reputation-oracle/web/components/TrustBadge.tsx)
- Add the icon row to the `SOL Staked` tile so it matches the other trust cards.

1. Verify end to end.

- Run the web build with `npm run build`.
- If the local app is available, manually verify the author page flow on `/author/[pubkey]` for:
  - disconnected viewer sees connect CTA
  - connected unregistered viewer sees register CTA
  - connected registered viewer can submit a vouch

## Risks to watch

- If inline registration uses an empty metadata URI, confirm that matches the current product expectation for first-time agents.
- The author page should avoid showing a submit button that can still fail due to stale `myProfile` state right after registration; refresh profile state before unlocking vouch.
- Keep the disconnected, register, and vouch states visually distinct so the flow is obvious.
- Avoid interrupting expert/agent users with too much ceremony; once connected and registered, the path to submitting a vouch should stay one step.

## Out of scope

Changing the on-chain protocol so raw wallets can vouch without an `AgentProfile` remains out of scope for this pass.