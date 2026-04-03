---
name: purchase rent redesign
overview: Redesign paid skill purchases so the listed price matches what buyers pay, while keeping on-chain purchase proof and cleaning up the repo-vs-chain listing contract exposed to the UI.
todos:
  - id: design-receipt-funding
    content: Design the listing-funded receipt model and migration behavior for existing listings.
    status: pending
  - id: update-program-purchase-model
    content: Implement the on-chain purchase and listing changes, then regenerate IDL/client artifacts.
    status: pending
  - id: standardize-listing-contract
    content: Normalize the API/UI listing contract across repo-backed and chain-only skills.
    status: pending
  - id: verify-cheap-skill-purchases
    content: Prove on devnet and in tests that `0.001 SOL` listings charge buyers only the listed price and still unlock correctly.
    status: pending
isProject: false
---

# Purchase Rent Redesign

## Recommendation

Adopt a seller-side receipt funding model rather than charging buyers per-purchase PDA rent.

Default recommendation:

- Keep the `Purchase` PDA as the canonical on-chain proof of ownership.
- Stop making the buyer fund that PDA rent.
- Introduce a listing-side receipt funding mechanism so buyers pay exactly `price_lamports`.
- Keep a short-term UI truthfulness patch during rollout so existing listings do not keep showing misleading sticker prices.

Why this is the best fit for your goals:

- It removes the hidden buyer fee that makes cheap skills feel broken.
- It preserves the current on-chain proof model used by install and x402 verification.
- It avoids introducing a platform treasury dependency as the only way purchases can succeed.
- You already said slight economics changes are acceptable if they remove user friction.

## Current Evidence

- [programs/reputation-oracle/src/instructions/purchase_skill.rs](programs/reputation-oracle/src/instructions/purchase_skill.rs) creates `purchase` with `init, payer = buyer`, so buyer funds storage today.
- [programs/reputation-oracle/src/state/purchase.rs](programs/reputation-oracle/src/state/purchase.rs) defines the persistent `Purchase` receipt account that causes the rent charge.
- [web/hooks/useReputationOracle.ts](web/hooks/useReputationOracle.ts) computes `totalLamports = priceLamports + rentLamports + PURCHASE_FEE_BUFFER_LAMPORTS`, which is why a `0.001 SOL` listing currently needs about `0.00256 SOL` to go through.
- [web/app/api/skills/[id]/route.ts](web/app/api/skills/[id]/route.ts), [web/app/api/skills/[id]/install/route.ts](web/app/api/skills/[id]/install/route.ts), and [web/app/api/skills/[id]/raw/route.ts](web/app/api/skills/[id]/raw/route.ts) still expose different behaviors for chain-only vs repo-backed skills, so the listing contract is not yet standardized.

## Proposed Design

### Protocol

- Add a listing-side receipt funding source so `purchase_skill` no longer requires buyer-funded rent.
- Prefer a listing-funded reserve over a platform treasury:
  - author/listing funds receipt storage upfront or tops it up
  - buyer only pays the listed price
  - `Purchase` PDA remains the proof object
- Update purchase settlement math so author/voucher proceeds and receipt funding are explicit and documented.
- Add a migration rule for existing listings:
  - legacy listings can remain readable
  - paid purchases should fail with a clear reason until receipt funding is topped up, or be grandfathered through a one-time migration path

### Listing Contract Standardization

Expose a unified skill listing contract to the UI/API for both repo-backed and chain-only skills:

- `listingPubkey`
- `source`: `repo` or `chain`
- `priceLamports`: buyer-visible sticker price only
- `firstPurchaseTotalLamports`: optional temporary rollout field until all listings are migrated
- `purchaseMode`: `onchainPurchase`
- `downloadMode`: `externalUri` or `appRaw`
- `installMode`: `walletInstall` or `externalOnly`
- `status`: `active`, `suspended`, `removed`

This removes guesswork from [web/app/skills/page.tsx](web/app/skills/page.tsx) and [web/app/skills/[id]/page.tsx](web/app/skills/[id]/page.tsx).

## Implementation Steps

- Update the on-chain purchase model in [programs/reputation-oracle/src/instructions/purchase_skill.rs](programs/reputation-oracle/src/instructions/purchase_skill.rs) and related state under [programs/reputation-oracle/src/state/](programs/reputation-oracle/src/state/) so buyers no longer fund receipt rent directly.
- Extend listing creation/update flows in [programs/reputation-oracle/src/instructions/create_skill_listing.rs](programs/reputation-oracle/src/instructions/create_skill_listing.rs) and [programs/reputation-oracle/src/instructions/update_skill_listing.rs](programs/reputation-oracle/src/instructions/update_skill_listing.rs) to support receipt funding and enforce the new invariants.
- Regenerate the IDL/client, then update [web/hooks/useReputationOracle.ts](web/hooks/useReputationOracle.ts) so purchase preflight checks `listed price` and `buyer total` correctly for the new model.
- Standardize the listing/access shape returned by [web/app/api/skills/route.ts](web/app/api/skills/route.ts) and [web/app/api/skills/[id]/route.ts](web/app/api/skills/[id]/route.ts), then simplify the marketplace/detail UI in [web/app/skills/page.tsx](web/app/skills/page.tsx) and [web/app/skills/[id]/page.tsx](web/app/skills/[id]/page.tsx).
- Keep install/raw/x402 verification aligned in [web/app/api/skills/[id]/install/route.ts](web/app/api/skills/[id]/install/route.ts), [web/app/api/skills/[id]/raw/route.ts](web/app/api/skills/[id]/raw/route.ts), and [web/lib/x402.ts](web/lib/x402.ts) so repo-backed and chain-only paid skills unlock consistently.

## Verification

- Anchor tests for buyer cost semantics, receipt funding depletion/top-up behavior, and purchase proof preservation.
- Web tests for marketplace/detail rendering of paid skills, including repo-backed vs chain-only paths.
- `anchor build` plus IDL/client regeneration.
- `npm test` and `npm run build` in `web/`.
- Devnet smoke test proving a `0.001 SOL` listing charges the buyer exactly the listed price, not listed price plus hidden receipt rent.

