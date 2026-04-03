---
name: Add Test Suites
overview: Add comprehensive tests covering x402 payment flow, web API routes, and dispute slash distribution. Uses Vitest for web tests and extends existing Anchor/Mocha tests for the program.
todos:
  - id: vitest-setup
    content: Install vitest and create config for web tests
    status: completed
  - id: x402-unit
    content: Write x402 lib unit tests
    status: completed
  - id: api-install
    content: Write skills install route tests
    status: completed
  - id: api-raw
    content: Write skills raw route tests (x402 flow)
    status: completed
  - id: api-landing
    content: Write landing route tests
    status: completed
  - id: dispute-balance
    content: Extend Anchor dispute test with slash balance assertions
    status: completed
isProject: false
---

# Add Test Suites

## Current State

- **Program tests**: Mocha + Chai via `anchor test` in `tests/reputation-oracle.ts` and `tests/marketplace.test.ts`. Covers config, agents, vouching, disputes (open + resolve), skill listings, purchases, revenue splits, and claims.
- **Web tests**: None. No framework, no test files, no test script.
- **x402**: Fully implemented in [web/lib/x402.ts](web/lib/x402.ts) with `generatePaymentRequirement`, `verifyPaymentProof`, `settlePayment`. Used in [web/app/api/skills/[id]/raw/route.ts](web/app/api/skills/[id]/raw/route.ts) for paid skill gating. Three supporting routes at `/api/x402/{supported,verify,settle}`.
- **Dispute slash distribution**: Just implemented in `resolve_dispute.rs` — challenger now receives bond + slashed stake. The existing test at line 300 of `tests/reputation-oracle.ts` resolves a dispute but does NOT verify the challenger's balance after slash.

## Plan

### 1. Set up Vitest for web tests

Install vitest + dependencies in `web/package.json`, add a `vitest.config.ts`, and a `test` script.

- `vitest`, `@vitest/coverage-v8` as devDependencies
- Config: resolve `@/` alias to `web/`, set `test.environment` to `node`

### 2. x402 unit tests -- `web/__tests__/lib/x402.test.ts`

Test the pure functions without network calls:

- `generatePaymentRequirement` — returns valid structure, 5-min expiry, correct amount/recipient
- `hashResource` — deterministic, consistent length
- `paymentRefFromProof` — deterministic for same inputs, different for different inputs
- `verifyPaymentProof` — rejects expired requirements, rejects invalid scheme/network, rejects short tx signatures
- `settlePayment` — caches results, returns `failed` for invalid proof

Mock `fetch` for the RPC call in `verifyPaymentProof` to test success/failure paths without hitting devnet.

### 3. API route tests -- `web/__tests__/api/`

Use Vitest with mocked dependencies. Each route handler can be imported directly and called with mock `NextRequest` objects.

`**skills-install.test.ts`** -- [web/app/api/skills/[id]/install/route.ts](web/app/api/skills/[id]/install/route.ts)

- Free repo skill (no on-chain address) -> 200
- Repo skill with on-chain price > 0 -> 402
- Chain-prefixed skill (free) -> 200
- Chain-prefixed skill (paid) -> 402
- Missing auth -> 400
- Invalid signature -> 401

`**skills-raw.test.ts`** -- [web/app/api/skills/[id]/raw/route.ts](web/app/api/skills/[id]/raw/route.ts)

- Free skill -> returns content directly
- Paid skill without proof -> 402 with X-Payment header
- Paid skill with valid proof -> returns content
- Paid skill with invalid proof -> 402

`**landing.test.ts`** -- [web/app/api/landing/route.ts](web/app/api/landing/route.ts)

- Returns metrics and featuredSkills
- Handles RPC failure gracefully (returns 500)

### 4. Extend Anchor dispute test -- `tests/reputation-oracle.ts`

Add balance assertions to the existing "Resolves a dispute (slash voucher)" test at line 300:

- Record challenger balance before resolve
- Record vouch PDA balance before resolve
- After resolve, assert challenger balance increased by `bond + (stake * slashPercentage / 100)`
- Assert vouch PDA balance decreased by the slash amount

### Files

- `web/vitest.config.ts` (new)
- `web/package.json` (add vitest deps + test script)
- `web/__tests__/lib/x402.test.ts` (new)
- `web/__tests__/api/skills-install.test.ts` (new)
- `web/__tests__/api/skills-raw.test.ts` (new)
- `web/__tests__/api/landing.test.ts` (new)
- `tests/reputation-oracle.ts` (extend dispute test with balance assertions)

