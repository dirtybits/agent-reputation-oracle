---
name: Fix Kit Migration Build
overview: Fix all remaining TypeScript build errors in the Solana Kit migration, then simplify transaction sending to use framework-kit's useSendTransaction instead of manual pipe/sign/send.
todos:
  - id: marketplace-types
    content: Replace manual SkillListingData/PurchaseData interfaces with Codama-generated types in marketplace/page.tsx
    status: completed
  - id: signer-fix
    content: Fix wallet signer + simplify sendIx to use useSendTransaction from @solana/react-hooks
    status: completed
  - id: build-verify
    content: Run npm run build, fix any remaining errors, verify app loads in browser
    status: completed
isProject: false
---

# Fix Remaining Kit Migration Build Errors

Sources consulted:

- [Kit README](https://github.com/anza-xyz/kit) — branded types, RPC API, transaction building
- `@solana/react-hooks` type defs — actual hook signatures (`useWalletConnection`, `useSendTransaction`, `useTransactionPool`)
- `/Users/andysustic/.cursor/skills/solana-dev/SKILL.md` + `frontend-framework-kit.md` — framework-kit patterns
- `@solana/client` wallet types — `WalletSession`, `createWalletTransactionSigner`

## Changes Already Applied (Pre-Plan)

These edits were made during investigation and are already on disk:

- `tsconfig.json`: target bumped from ES2017 to ES2022 (bigint literal support)
- `wallet.address` -> `wallet.account.address` in 4 files (page.tsx, marketplace/page.tsx, skills/publish/page.tsx, ClientWalletButton.tsx)
- Branded type casts (`as Base64EncodedBytes`, `as Base58EncodedBytes`) on memcmp filter `bytes` in hook and route
- `{ value: accounts }` -> `accounts` for `getProgramAccounts` return in hook and route (Kit returns array directly, not `{ value }`)

## Fix 1: Marketplace SkillListingData Type

**File**: [web/app/marketplace/page.tsx](web/app/marketplace/page.tsx)

The local `SkillListingData` interface (lines 30-45) defines `status: { __kind: string }` which doesn't match the Codama-generated `SkillStatus` enum. The `getAllSkillListings()` return type is `{ publicKey: Address; account: SkillListing }[]`.

**Fix**: Remove manual `SkillListingData`/`PurchaseData` interfaces. Import `SkillListing`, `Purchase`, `SkillStatus` from the generated client. Update filter/sort callbacks to use the actual types. For the status check, use `l.account.status === SkillStatus.Active` instead of `l.account.status?.active !== undefined`.

## Fix 2: Signer + Transaction Sending in Hook

**File**: [web/hooks/useReputationOracle.ts](web/hooks/useReputationOracle.ts)

Two problems:

1. Line 93: `wallet.signer` doesn't exist on `WalletSession`. Use `createWalletTransactionSigner(wallet).signer` from `@solana/client`.
2. Lines 97-110: Manual `sendIx` builds transactions by hand (fetch blockhash, pipe, sign, send). Per the skill docs, prefer `useSendTransaction()` from `@solana/react-hooks`.

**Fix option A (minimal — just fix the type error)**:

```typescript
import { createWalletTransactionSigner } from '@solana/client';

const signer: TransactionSigner | null = useMemo(() => {
  if (!connected || !wallet) return null;
  return createWalletTransactionSigner(wallet).signer;
}, [connected, wallet]);
```

**Fix option B (preferred — use framework-kit `useSendTransaction`):**
Replace `sendIx` with framework-kit's `useSendTransaction().send({ instructions: [ix] })`:

```typescript
import { useSendTransaction } from '@solana/react-hooks';

const { send: sendTransaction } = useSendTransaction();

const sendIx = useCallback(async (ix: any) => {
  if (!walletAddress) throw new Error('Wallet not connected');
  const sig = await sendTransaction({ instructions: [ix] });
  return sig;
}, [walletAddress, sendTransaction]);
```

This eliminates manual blockhash fetching, pipe composition, and signing — the client handles it all. The signer construction also becomes unnecessary for this path since the connected wallet session is used automatically.

We still need `createWalletTransactionSigner` for instruction builders that require a `TransactionSigner` argument (like Codama-generated async instructions that take `authority: signer`).

## Verification

After all fixes, run `npm run build` and confirm zero TypeScript errors, then verify the app loads in the browser.