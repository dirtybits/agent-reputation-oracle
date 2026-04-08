---
name: skill preview cleanup
overview: Tighten the marketplace skill preview card into a cleaner, more scannable layout by reducing repeated pricing/trust surfaces, grouping metadata, and extracting the inline card into a reusable component. Keep trust signals prominent, but present them as a compact utilitarian card instead of a stacked checklist.
todos:
  - id: define-card-hierarchy
    content: "Lock the information hierarchy for the preview card: one price surface, one trust surface, and a compact metadata footer."
    status: completed
  - id: extract-skill-card
    content: Extract the inline marketplace card JSX from `web/app/skills/page.tsx` into a dedicated reusable component.
    status: completed
  - id: simplify-trust-pricing
    content: Refactor trust and pricing presentation so the preview card removes repeated paragraphs and duplicate totals while preserving key signals.
    status: completed
  - id: align-doc-and-detail
    content: Update the preview layout doc and check adjacent surfaces like the skill detail page for naming and visual consistency.
    status: completed
  - id: verify-narrow-layout
    content: Verify the card at narrow widths and with long titles/descriptions, free vs paid states, and clean vs disputed trust states.
    status: completed
isProject: false
---

# Skill Preview Cleanup Plan

## Direction
Use a compact utilitarian card: strong typography, minimal decoration, clear row grouping, and no repeated explanatory copy inside the card itself. The memorable part should be that the card feels crisp and data-rich without reading like a checklist.

## Current Issues
- The current marketplace preview in [web/app/skills/page.tsx](file:///Users/andysustic/Repos/agent-reputation-oracle/web/app/skills/page.tsx) is inline JSX and mixes content hierarchy, trust logic, pricing, and CTA state in one large block.
- Pricing is repeated across the header, the `Estimated total` box, and the CTA copy.
- Trust is repeated through [web/components/TrustBadge.tsx](file:///Users/andysustic/Repos/agent-reputation-oracle/web/components/TrustBadge.tsx), the extra explanatory paragraph, and the author-trust link text.
- The desired layout in [docs/SKILL_PREVIEW_LAYOUT.md](file:///Users/andysustic/Repos/agent-reputation-oracle/docs/SKILL_PREVIEW_LAYOUT.md) is cleaner than the current implementation, but line-by-line rows for every field would still make the card too tall and busy.

## Proposed Layout
- Header row: title, version pill, primary price pill.
- Body: two-line description, then one author row.
- Trust block: compact stat grid or paired rows for reputation, vouchers, disputes, backing, self stake, and downloads.
- Footer: tags, one trust/details link, then the CTA.
- Hidden behind tooltip or secondary state: long trust explanations, creator payout explanation, receipt-rent detail, raw URL text.

## Implementation Steps
1. Define the final card contract.
- Use [docs/SKILL_PREVIEW_LAYOUT.md](file:///Users/andysustic/Repos/agent-reputation-oracle/docs/SKILL_PREVIEW_LAYOUT.md) as the intent document, but revise implementation around grouped sections rather than one row per metric.
- Decide the exact truncation rules for title and description, and which fields get tooltips.
- Preserve the trust vocabulary already established in [AGENTS.md](file:///Users/andysustic/Repos/agent-reputation-oracle/AGENTS.md): `Vouch` stays external endorsement, `Self stake` maps to `AuthorBond` / `SelfStake`, and dispute states need plain labels.

2. Extract a dedicated card component.
- Move the marketplace card UI out of [web/app/skills/page.tsx](file:///Users/andysustic/Repos/agent-reputation-oracle/web/app/skills/page.tsx) into a dedicated component such as `web/components/SkillPreviewCard.tsx`.
- Keep CTA-state logic and formatting helpers close enough to avoid regressions, but centralize presentation so future cleanup does not require editing a long page file.
- Reuse [web/components/SolAmount.tsx](file:///Users/andysustic/Repos/agent-reputation-oracle/web/components/SolAmount.tsx) and [web/components/TrustBadge.tsx](file:///Users/andysustic/Repos/agent-reputation-oracle/web/components/TrustBadge.tsx) where they still fit; avoid duplicating trust formatting again inside the new component.

3. Reduce duplication.
- Show one primary paid-price surface in the card.
- Move `Estimated total` and `Creator price` to a hover, tooltip, or a collapsed secondary area if they are still needed before purchase.
- Remove the trust explainer paragraph from the preview card and keep only the compact trust stats plus a single author-trust link.
- Collapse low-priority metadata like raw URI text out of the preview card entirely.

4. Keep detail-page consistency without over-coupling.
- Review [web/app/skills/[id]/page.tsx](file:///Users/andysustic/Repos/agent-reputation-oracle/web/app/skills/[id]/page.tsx) to ensure the preview-card terminology matches the detail page, especially around price, disputes, backing, and self stake.
- Do not force the detail page into the same layout; only align labels, tooltip copy, and pricing semantics.

5. Verify across real states.
- Long title and long description truncation.
- Free skill vs paid skill.
- Clean dispute state vs open challenge vs failed challenge.
- Low-trust author vs high-trust author.
- Narrow card width similar to the screenshot you shared.
- Wallet disconnected, connected, already purchased, and own-skill CTA states.

## Likely Files
- [docs/SKILL_PREVIEW_LAYOUT.md](file:///Users/andysustic/Repos/agent-reputation-oracle/docs/SKILL_PREVIEW_LAYOUT.md)
- [web/app/skills/page.tsx](file:///Users/andysustic/Repos/agent-reputation-oracle/web/app/skills/page.tsx)
- [web/components/TrustBadge.tsx](file:///Users/andysustic/Repos/agent-reputation-oracle/web/components/TrustBadge.tsx)
- [web/components/SolAmount.tsx](file:///Users/andysustic/Repos/agent-reputation-oracle/web/components/SolAmount.tsx)
- [web/app/skills/[id]/page.tsx](file:///Users/andysustic/Repos/agent-reputation-oracle/web/app/skills/[id]/page.tsx)

## Risks
- The biggest risk is over-preserving every current field and ending up with a visually cleaner card that is still semantically crowded.
- The second risk is splitting the card into a new component but leaving pricing and trust logic duplicated between preview and detail surfaces.
- The safest constraint is: if a piece of information does not change the install decision at preview time, it should not compete for top-level space on the card.