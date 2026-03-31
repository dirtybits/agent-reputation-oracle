---
name: purchase price transparency
overview: Expand the purchase transparency plan so it covers both buyer-side hidden Purchase PDA rent and recipient-side rent-floor failures on cheap listings, explicitly keep seller payout-wallet rent as a seller responsibility, and make the app detect and explain those cases before Phantom opens whenever possible.
todos:
  - id: define-preflight-fields
    content: Define API fields for creator price, estimated buyer total, and purchase preflight status/message
    status: completed
  - id: build-shared-preflight-helper
    content: Create shared helper for buyer-side rent estimation and author payout rent-floor checks
    status: completed
  - id: wire-api-preflight
    content: Expose purchase preflight status for repo-backed and chain-only skills
    status: completed
  - id: update-marketplace-preflight-ui
    content: Show estimated total and author-wallet rent warnings on marketplace cards
    status: completed
  - id: update-detail-preflight-ui
    content: Block Buy & Install in-app when buyer balance or author payout rent-floor checks fail
    status: completed
  - id: verify-delete-this-skill-case
    content: Prove the exact Delete This Skill listing now shows the real author-wallet rent failure before Phantom opens
    status: completed
isProject: false
---

# Purchase Price Transparency

## Goal

Fix the misleading purchase experience for existing listings without changing the on-chain program yet.

The app needs to explain two distinct hidden-cost failure modes before the wallet prompt:

- buyer-side receipt rent: the buyer pays more than the listed creator price because `Purchase` is `init, payer = buyer`
- recipient-side rent floor: very cheap listings can fail if the author payout account is empty and the 60% payout is too small to leave that account rent-exempt

Policy decision for this stage:

- buyers do not fund seller payout-wallet rent
- sellers are responsible for maintaining a rent-safe payout destination
- the app should block purchase attempts and explain the seller-side issue before Phantom opens

## Confirmed Root Causes

### 1. Buyer-side hidden total

Current purchase cost is not just the visible listing price.

Evidence:

- [programs/reputation-oracle/src/instructions/purchase_skill.rs](programs/reputation-oracle/src/instructions/purchase_skill.rs) creates `purchase` with `init, payer = buyer`
- [programs/reputation-oracle/src/state/purchase.rs](programs/reputation-oracle/src/state/purchase.rs) defines an 89-byte persistent receipt account
- current devnet rent for that account is about `0.00151032 SOL`
- [web/hooks/useReputationOracle.ts](web/hooks/useReputationOracle.ts) already estimates `price + rent + fee buffer`

### 2. Recipient-side rent floor on cheap listings

For the exact listing `2a7HZ7D6z4d1No8RvtK3CgvZJsKaVsrKJM7FuxaYwuDo` (`Delete This Skill`), the failure is not the buyer wallet.

Confirmed facts:

- buyer wallet `asuavUDGmrVHr4oD1b4QtnnXgtnEcBa8qdkfZz7WZgw` has `33.57845558 SOL` on the app's devnet RPC
- listing price is `0.001 SOL`
- author share at 60% is `0.0006 SOL`
- author wallet `2DGYWtztLvPB6GxgGXT16gjCoEf56jEmwSxjMwK21Pg3` has `0 SOL`
- rent-exempt minimum for a fresh system account on devnet is `0.00089088 SOL`
- exact RPC simulation returns `InsufficientFundsForRent` for the author account index, not the buyer account

That means a `0.001 SOL` listing can fail even when the buyer has plenty of SOL, because the transfer to an empty author wallet is itself too small to create/maintain a rent-exempt system account.

## Product Requirements

The app should stop letting users discover either of these problems only after clicking buy.

For existing listings, before wallet handoff, the app should surface:

- creator price
- estimated buyer total
- whether the listing is currently purchasable under the current rent conditions
- if not purchasable, the exact reason in plain language

Explicitly out of scope for this stage:

- adding seller wallet funding costs to the buyer
- silently attempting to subsidize the seller payout account

## Proposed Runtime Checks

### Buyer-side check

Continue estimating:

- `creatorPriceLamports`
- `estimatedPurchaseRentLamports`
- `feeBufferLamports`
- `estimatedBuyerTotalLamports`

If buyer balance is below `estimatedBuyerTotalLamports`, fail early in-app.

### Recipient-side check

Add a preflight check for paid listings:

- fetch author payout wallet balance on the configured cluster
- compute `authorShareLamports = floor(priceLamports * 60 / 100)`
- fetch current rent-exempt minimum for a 0-byte system account
- if `authorBalance === 0` and `authorShareLamports < systemAccountRentExemptLamports`, mark listing as temporarily not purchasable

Decision:

- do not add the missing seller rent amount to the buyer's required total
- do not attempt to auto-fund the seller wallet
- instead, fail early in-app and surface a seller-maintenance message

Suggested explanation:

- `This low-priced listing cannot currently be purchased because the author's payout wallet is empty and the payout would be below Solana's rent minimum. The author needs a small amount of SOL in their wallet first.`

This keeps the explanation factual and avoids implying the buyer is at fault.

## Proposed API Contract

Extend the normalized skill pricing/purchase fields returned by [web/app/api/skills/route.ts](web/app/api/skills/route.ts) and [web/app/api/skills/[id]/route.ts](web/app/api/skills/[id]/route.ts):

- `creatorPriceLamports`
- `estimatedPurchaseRentLamports`
- `feeBufferLamports`
- `estimatedBuyerTotalLamports`
- `purchasePreflightStatus`: `ok` | `buyerInsufficientBalance` | `authorPayoutRentBlocked` | `estimateUnavailable`
- `purchasePreflightMessage`
- `priceDisclosure`

For paid listings, `purchasePreflightStatus` should capture both hidden-failure classes.

## UI Behavior

### Marketplace

In [web/app/skills/page.tsx](web/app/skills/page.tsx):

- show `Estimated total` as the primary paid price
- show `Creator price` as a secondary label
- if `authorPayoutRentBlocked`, do not present the card as normally buyable
- show a compact warning explaining the author-wallet rent edge case

### Skill detail

In [web/app/skills/[id]/page.tsx](web/app/skills/[id]/page.tsx):

- show both creator price and estimated buyer total
- show a preflight status block near the CTA
- block the `Buy & Install` flow in-app if either:
  - buyer balance is insufficient
  - author payout rent floor would fail
- error copy should distinguish buyer-side vs author-side causes

## Scope Now

Do now:

- normalize buyer-total fields
- add recipient-rent preflight checks
- update marketplace/detail UI to explain both edge cases
- add focused tests for cheap listings and empty-author-wallet failure mode

Defer:

- protocol redesign
- Postgres purchase cache
- automatic author-wallet funding or treasury intervention
- any model where buyers fund seller payout-wallet rent

## Implementation Steps

- Add a shared purchase preflight helper under [web/lib/](web/lib/) that computes both buyer-side totals and recipient-side rent-floor checks.
- Update [web/app/api/skills/route.ts](web/app/api/skills/route.ts) and [web/app/api/skills/[id]/route.ts](web/app/api/skills/[id]/route.ts) to expose the normalized purchase preflight fields.
- Refactor [web/hooks/useReputationOracle.ts](web/hooks/useReputationOracle.ts) so purchase preflight covers both hidden-cost classes before calling `frameworkSend`.
- Update [web/app/skills/page.tsx](web/app/skills/page.tsx) to show estimated total and temporary purchase blocking when author payout would fail rent rules.
- Update [web/app/skills/[id]/page.tsx](web/app/skills/[id]/page.tsx) to show the same preflight explanation and block buy attempts before Phantom opens.
- Keep [web/app/api/skills/[id]/install/route.ts](web/app/api/skills/[id]/install/route.ts), [web/app/api/skills/[id]/raw/route.ts](web/app/api/skills/[id]/raw/route.ts), and [web/lib/x402.ts](web/lib/x402.ts) behavior unchanged except for shared types if needed.

## Verification

- Unit tests for purchase preflight helper:
  - free listing
  - `0.001 SOL` listing with sufficient buyer and funded author wallet
  - `0.001 SOL` listing with sufficient buyer and empty author wallet
  - `0.1 SOL` listing with empty author wallet but valid payout size
- Web tests verifying marketplace/detail pages explain both failure classes correctly.
- A focused test that ensures the buy flow stops in-app before Phantom opens when `authorPayoutRentBlocked` is true.
- `npm test` and `npm run build` in [web/](web/).
- Manual devnet check on the exact `Delete This Skill` listing proving the app now explains the real failure cause instead of letting Phantom show a misleading insufficient-SOL message.

## Follow-up

Later, if you want to eliminate this class of edge case entirely, the better protocol design is to avoid paying raw proceeds directly into the author wallet at purchase time.

Preferred long-term design note:

- send proceeds to a program-controlled listing PDA or treasury-style escrow first
- let the author withdraw later to a chosen destination wallet
- keep seller wallet rent state from affecting buyer purchase success

Other protocol redesign options remain:

- route proceeds to a listing-controlled PDA instead of the raw author wallet
- require a funded payout destination at listing time
- redesign the split/receipt model so low-priced listings remain purchasable without author wallet state affecting success

