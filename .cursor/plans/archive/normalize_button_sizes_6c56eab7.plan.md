---
name: Normalize Button Sizes
overview: Standardize button proportions around the active nav button sizing and update the most visible mismatches without overreaching into every micro-control.
todos:
  - id: identify-shared-size-hook
    content: Introduce or reuse a shared size class for nav-style buttons based on `AppNavbar`.
    status: completed
  - id: normalize-header-controls
    content: Apply the shared sizing to `ThemeToggle` and `ClientWalletButton`.
    status: completed
  - id: normalize-obvious-page-ctas
    content: Update oversized CTA buttons on the landing, marketplace, skill detail, author, and competition pages to the new baseline.
    status: completed
  - id: verify-lints-and-layout
    content: Run lint checks on touched files and visually confirm header/page button alignment.
    status: completed
isProject: false
---

# Normalize Button Sizes

## Target baseline

Use the active nav button in [web/components/AppNavbar.tsx](web/components/AppNavbar.tsx) as the shared proportion reference. Current baseline is the `navLinkClass()` sizing: `px-3 py-1.5 text-sm rounded-lg`.

## Implementation approach

- Extract a small shared button-size helper or constant in the navbar/button layer so the header controls stop drifting.
- Update [web/components/ThemeToggle.tsx](web/components/ThemeToggle.tsx) and [web/components/ClientWalletButton.tsx](web/components/ClientWalletButton.tsx) to match the nav baseline height, radius, and text sizing.
- Normalize the obvious oversized CTAs in the pages already using larger button treatments, especially [web/app/page.tsx](web/app/page.tsx), [web/app/skills/page.tsx](web/app/skills/page.tsx), [web/app/skills/[id]/page.tsx](web/app/skills/[id]/page.tsx), and the other CTA-heavy surfaces already touched in this branch such as [web/app/author/[pubkey]/page.tsx](web/app/author/[pubkey]/page.tsx) and [web/app/competition/page.tsx](web/app/competition/page.tsx).
- Leave tiny icon-only utility controls and segmented toggles alone unless they clearly read as primary buttons, so the change stays visually consistent without flattening intentional UI patterns.

## Verification

- Check the edited files for lint issues.
- Verify the header row visually stays aligned after the wallet button and theme toggle shrink to the nav size.
- Spot-check the landing page and marketplace/detail CTAs to confirm they now match the header proportions and still wrap/read correctly on small screens.

