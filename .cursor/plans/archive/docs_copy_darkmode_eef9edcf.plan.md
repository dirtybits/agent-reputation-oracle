---
name: docs copy darkmode
overview: Add a small shared copyable code/address block for the docs page and swap the inline `/docs` blocks to use it. Reuse the app’s existing dark-mode conventions and verify with lint/build checks.
todos:
  - id: inspect-target-blocks
    content: Map all `/docs` address and code blocks that should use the shared copyable component
    status: completed
  - id: build-copyable-component
    content: Create a reusable docs code/address block component with copy feedback and theme-aware styles
    status: completed
  - id: wire-docs-page
    content: Replace inline blocks in `web/app/docs/page.tsx` with the shared component
    status: completed
  - id: verify-ui-change
    content: Run lints and `npm run build` in `web/` to validate the change
    status: completed
isProject: false
---

# Add Dark Mode And Copy Support In Docs

## Scope

Update the docs UI under [web/app/docs/page.tsx](/Users/andysustic/Repos/agent-reputation-oracle/web/app/docs/page.tsx) so address/code blocks have explicit light and dark styling plus copy-to-clipboard controls.

## Findings

- `/docs` is currently a client page with hardcoded blocks for `Program ID`, curl examples, and on-chain address/code examples.
- Global dark mode already exists in [web/app/layout.tsx](/Users/andysustic/Repos/agent-reputation-oracle/web/app/layout.tsx) via `next-themes`, so no new theme provider work is needed.
- There is no shared copy button component yet, but [web/app/skills/[id]/page.tsx](/Users/andysustic/Repos/agent-reputation-oracle/web/app/skills/[id]/page.tsx) already has a working `copyToClipboard()` interaction pattern to mirror.

## Implementation

- Add a small shared client component in `web/components` for copyable code/address content.
- The component should support:
  - label/title text when needed
  - copy button with `Copy` / `Copied!` feedback
  - mono rendering and horizontal scrolling for long Solana addresses
  - app-consistent light/dark classes such as `bg-gray-50 dark:bg-gray-800`, `border-gray-200 dark:border-gray-700`, and readable mono text colors
- Replace the inline docs blocks in [web/app/docs/page.tsx](/Users/andysustic/Repos/agent-reputation-oracle/web/app/docs/page.tsx) with the shared component for:
  - `Download Skill` command
  - `Program ID`
  - REST API curl examples
  - on-chain example snippets, including the wallet address placeholder block
- Keep the existing docs card layout and typography intact so the change stays local to machine-readable blocks.

## Verification

- Run lints on the touched files.
- Run `npm run build` from `web/` because this is a substantive UI change.
- Confirm the docs route still renders in both themes and that each target block copies the expected text.

