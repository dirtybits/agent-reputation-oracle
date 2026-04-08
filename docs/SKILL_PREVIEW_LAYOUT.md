Let's clean up the skill preview info card.

Use a compact utilitarian card with grouped sections, not a long stacked checklist.

- Header row
  - Title sits first, single line only
  - If the title is longer than 32 chars, truncate with `...`
  - Add a tooltip so the full title is still visible
  - Keep version on the same row in a bordered accent pill
  - Keep a single primary price pill on the same row
  - For paid skills, that pill should show the estimated buyer total
  - For free skills, show a `Free` pill

- Description
  - Place directly under the header
  - Trim to roughly 64 chars and cut at the last whole word that fits
  - Show the full text in a tooltip

- Author row
  - Show author icon plus linked author identifier on its own line
  - Tooltip should explain that this is the publishing author and payout recipient

- Trust block
  - Use a compact 2-column stat grid instead of one separate row per metric
  - Include:
    - Reputation
    - Vouches
    - Disputes
    - Backing
    - Self stake
    - Downloads
  - Each stat gets a tooltip with a short explanation
  - Disputes should use stateful color and copy:
    - `Clean`
    - `{n} open`
    - `{n} upheld`

- Footer
  - Tags live in the footer as compact pills
  - Show one small trust/details link
  - Do not show the raw `skill_uri` or IPFS CID in the preview card

- Price details
  - Do not repeat pricing in a separate always-visible `Estimated total` box
  - Keep `Creator price` and any rent explanation in tooltip or secondary detail state
  - The card should have one primary price surface at rest

- CTA
  - Keep the CTA at the bottom behind a divider
  - Preserve the current wallet and purchase states:
    - `Connect Wallet to Buy`
    - `Buy Skill`
    - `Purchased`
    - `Your Skill`
    - `Seller Needs SOL`
    - `Need More SOL`
