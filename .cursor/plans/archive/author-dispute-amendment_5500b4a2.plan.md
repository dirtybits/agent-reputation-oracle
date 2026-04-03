---
name: author-dispute-amendment
overview: Amend the Phase 2 author dispute plan with an explicit no-self-vouch assumption and a clearer Phase 3 AuthorBond direction, without changing Phase 2 scope or architecture.
todos:
  - id: amend-phase2-assumptions
    content: Add explicit no-self-vouch and external-endorsement-only assumptions to the Phase 2 author dispute plan.
    status: completed
  - id: amend-phase3-direction
    content: Clarify in the Phase 2 plan that Phase 3 should introduce AuthorBond as first-loss self-stake with separate reward mechanics.
    status: completed
isProject: false
---

# Author Dispute Model Amendment

## Purpose

This amendment clarifies two future-facing assumptions for `[/.cursor/plans/author-dispute-model_7027f28c.plan.md](/Users/andysustic/Repos/agent-reputation-oracle/.cursor/plans/author-dispute-model_7027f28c.plan.md)`:

- `Vouch` remains external endorsement only.
- `AuthorBond` / `SelfStake` becomes the canonical self-posted stake model in Phase 3.

This amendment does **not** change the core Phase 2 design.

## What Stays Unchanged

The following parts of the existing plan still stand:

- `Report` remains the user-facing action.
- `AuthorDispute` remains the Phase 2 first-class protocol object.
- `VouchDispute` remains the lower-level enforcement object.
- Phase 2 still excludes author stake and self-stake implementation.

## Amendment

Add the following explicit assumptions to the Phase 2 plan:

- `Vouch` remains reserved for third-party endorsement.
- Self-vouching stays disallowed.
- Self-posted stake should not be modeled by relaxing the self-vouch restriction.
- Future self-posted stake should be modeled as a distinct first-class object: `AuthorBond` or `SelfStake`.

## Phase 3 Direction

Strengthen the Phase 3 direction in the existing plan with these assumptions:

- `AuthorBond` is the author’s first-party capital-at-risk object.
- `AuthorBond` is slashed before backing vouchers when an author dispute is upheld.
- `AuthorBond` may receive stronger rewards because it bears first-loss risk.
- Those rewards should come from an explicit author-bond mechanism, not from the voucher revenue pool.
- Voucher revenue share remains for external validators only.

## Recommended Edits To The Existing Plan

If we fold this amendment into `[/.cursor/plans/author-dispute-model_7027f28c.plan.md](/Users/andysustic/Repos/agent-reputation-oracle/.cursor/plans/author-dispute-model_7027f28c.plan.md)`, the main edits should be limited to:

- `Assumptions for this phase`
- `Scope` or `What this phase should not add`
- `Risks`
- `Next Steps`

Suggested additions:

- Under assumptions: `Self-vouch remains disallowed; Vouch remains external endorsement only.`
- Under scope exclusions: `This phase does not repurpose Vouch for self-stake.`
- Under next steps: `Phase 3 should introduce AuthorBond as a first-class self-stake object with first-loss slash priority and separate reward mechanics.`

## Why This Amendment Matters

This keeps the protocol semantics clean:

- `Vouch` = outside trust
- `AuthorDispute` = formal case record
- `AuthorBond` = self-posted first-loss capital

That separation reduces future migration debt and prevents Phase 3 from having to unwind self-vouch behavior later.

## Exit Criteria

This amendment is complete once the existing Phase 2 plan clearly states:

- no self-vouching
- no self-stake via `Vouch`
- `AuthorBond` is the intended Phase 3 self-stake model

