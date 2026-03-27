---
name: fix-author-dispute-settlement
overview: Investigate and fix the mismatch where upheld author-wide disputes increment report counts but do not slash or reclassify the linked backing vouches. Align protocol settlement, UI semantics, and tests with the author-wide slashing behavior the product expects.
todos:
  - id: protocol-author-dispute-slash
    content: Extend author-dispute uphold resolution to slash each snapshotted backing vouch and update profile accounting.
    status: completed
  - id: ui-author-trust-alignment
    content: Align trust labels and author page rendering with the new author-wide slash semantics.
    status: completed
  - id: verify-author-dispute-uphold
    content: Update tests and run Anchor build/test plus web client/build verification.
    status: completed
isProject: false
---

# Fix Author Dispute Settlement

## Findings

- [programs/reputation-oracle/src/instructions/resolve_author_dispute.rs](programs/reputation-oracle/src/instructions/resolve_author_dispute.rs) currently only marks the `AuthorDispute` resolved and transfers the dispute bond. It does not load or mutate any linked `Vouch` accounts.
- [programs/reputation-oracle/src/instructions/resolve_dispute.rs](programs/reputation-oracle/src/instructions/resolve_dispute.rs) is the only place that currently performs slashing, `VouchStatus` changes, and `AgentProfile` counter updates.
- [tests/author-disputes.ts](tests/author-disputes.ts) currently asserts that linked vouches remain `active` after an upheld author dispute, so the current test suite locks in the wrong behavior for this product expectation.
- [web/components/TrustBadge.tsx](web/components/TrustBadge.tsx) and [web/app/author/[pubkey]/page.tsx](web/app/author/[pubkey]/page.tsx) render two different concepts today: author-report history vs raw `Vouch.status`. The mismatch the user saw is real, not just stale UI state.

## Plan

- Extend [programs/reputation-oracle/src/instructions/resolve_author_dispute.rs](programs/reputation-oracle/src/instructions/resolve_author_dispute.rs) so `Upheld` settles every snapshotted backing vouch. Use the existing [programs/reputation-oracle/src/state/author_dispute_vouch_link.rs](programs/reputation-oracle/src/state/author_dispute_vouch_link.rs) records to validate supplied remaining accounts, then apply the same slashing semantics used in [programs/reputation-oracle/src/instructions/resolve_dispute.rs](programs/reputation-oracle/src/instructions/resolve_dispute.rs): mark affected vouches `Slashed`, transfer slash amounts from each vouch PDA to the challenger, decrement the relevant voucher/author counters, and recompute author reputation.
- Keep `Dismissed` bond-only, but make the uphold path explicitly fail if the settlement account set is incomplete or inconsistent with the stored author-wide snapshot.
- Update any emitted event fields and helper code touched by author-dispute resolution so the post-resolution state is internally consistent and easier to inspect.
- Update [web/components/TrustBadge.tsx](web/components/TrustBadge.tsx), [web/lib/trust.ts](web/lib/trust.ts), and [web/app/author/[pubkey]/page.tsx](web/app/author/[pubkey]/page.tsx) so the page no longer implies that an author is still entirely "clean" once an upheld author-wide dispute has slashed backing vouches. The vouch rows should naturally reflect `Slashed` after the protocol fix; separately tighten the trust-label wording so "Vouch Disputes" is not confused with author-wide reports.
- Rewrite [tests/author-disputes.ts](tests/author-disputes.ts) to expect the new uphold semantics, including slashed vouch statuses, challenger payout from bond plus slash amounts, and updated profile counters. Add or adjust focused web tests if trust-label copy changes.
- Verify with `anchor clean && anchor build`, the relevant Anchor test file, IDL/client regeneration for `web/`, and `npm run build` in `web/`.

