---
name: Solana Kit Migration
overview: Migrate the frontend from @coral-xyz/anchor + @solana/web3.js to @solana/kit + Codama-generated client, while keeping scripts/tests on Anchor. This reduces bundle size, adds type safety, and modernizes the wallet connection layer.
todos:
  - id: phase-0-codama
    content: "Phase 0: Set up Codama generation script, sync IDL, generate typed client to web/generated/"
    status: completed
  - id: phase-1-wallet
    content: "Phase 1: Replace wallet-adapter with @solana/react-hooks + @solana/client (WalletContextProvider, ClientWalletButton, all useWallet consumers)"
    status: completed
  - id: phase-2-hook
    content: "Phase 2: Rewrite useReputationOracle.ts to use Codama-generated client + Kit RPC instead of Anchor Program"
    status: completed
  - id: phase-3-server
    content: "Phase 3: Rewrite trust.ts and auth.ts to use Kit types (server-side, no Anchor dependency)"
    status: completed
  - id: phase-4-cleanup
    content: "Phase 4: Remove old Solana/Anchor deps from web/package.json, verify build, test all flows"
    status: completed
isProject: false
---

# Solana Kit + Codama Migration

## Phase 0: Codama Client Generation (no app changes)

Add a generation script that converts `target/idl/reputation_oracle.json` into a Kit-native TypeScript client.

- Install: `@codama/nodes-from-anchor`, `@codama/renderers-js`, `@solana/kit`
- Create `scripts/generate-client.ts` that reads the Anchor IDL and outputs to `web/generated/reputation-oracle/`
- Generated output includes typed instruction builders (`getRegisterAgentInstruction`, `getVouchInstruction`, etc.) and account decoders (`decodeAgentProfile`, `decodeSkillListing`, etc.)
- Add `web/generated/` to `.gitignore` or check it in (your preference)
- **Sync IDL first**: copy `target/idl/reputation_oracle.json` to `web/reputation_oracle.json` — the web copy is missing `claim_voucher_revenue`

## Phase 1: Replace Wallet Layer

Swap `@solana/wallet-adapter-react` + `@solana/wallet-adapter-react-ui` + `@solana/wallet-adapter-wallets` for `@solana/react-hooks` + `@solana/client`.

Files changed:

- [web/components/WalletContextProvider.tsx](web/components/WalletContextProvider.tsx) — replace `ConnectionProvider` / `WalletProvider` / `WalletModalProvider` with `SolanaProvider` from `@solana/react-hooks`
- [web/components/ClientWalletButton.tsx](web/components/ClientWalletButton.tsx) — replace `WalletMultiButton` with a custom connect button using `useWalletConnection()`
- [web/app/globals.css](web/app/globals.css) — remove `.wallet-adapter-`* styles

Impact: every page that calls `useWallet()` or `useConnection()` needs to switch to the new hooks. That's `page.tsx`, `marketplace/page.tsx`, `skills/publish/page.tsx`, and `useReputationOracle.ts`.

## Phase 2: Rewrite `useReputationOracle.ts`

Replace the Anchor `Program` usage with the Codama-generated client + `@solana/kit` RPC.

Current pattern (Anchor):

```typescript
const tx = await program.methods.vouch(new BN(amount)).accounts({...}).rpc();
```

New pattern (Kit + Codama):

```typescript
import { getVouchInstruction } from '../generated/reputation-oracle';
import { pipe, createTransactionMessage, setTransactionMessageFeePayerSigner, ... } from '@solana/kit';

const ix = getVouchInstruction({
  voucher: walletAccount,
  voucherProfile: address('...'),
  voucheeProfile: address('...'),
  config: address('...'),
  vouch: address('...'),
  systemProgram: SYSTEM_PROGRAM_ADDRESS,
  stakeAmount: amount,
});
```

Key changes in [web/hooks/useReputationOracle.ts](web/hooks/useReputationOracle.ts):

- Remove `Program`, `AnchorProvider`, `BN`, `web3` imports
- Replace `PublicKey.findProgramAddressSync` with `getProgramDerivedAddress` from `@solana/kit`
- Replace `program.account.*.fetch()` with Codama-generated `decodeAgentProfile()` + Kit RPC `getAccountInfo()`
- Replace `program.account.*.all()` with Kit RPC `getProgramAccounts()` + Codama decoders
- Replace `program.methods.*.rpc()` with Kit transaction building + signing + sending

## Phase 3: Rewrite Server-Side (`trust.ts` + `auth.ts`)

- [web/lib/trust.ts](web/lib/trust.ts): Replace `Connection` + `AnchorProvider` + `Program` with `createSolanaRpc()` from `@solana/kit` + Codama account decoders. No wallet needed — this is read-only.
- [web/lib/auth.ts](web/lib/auth.ts): Replace `new PublicKey(pubkey).toBytes()` with `getAddressCodec().encode(address(pubkey))` or simply `bs58.decode(pubkey)`. Trivial change since nacl just needs the raw 32 bytes.

## Phase 4: Clean Up Dependencies

Remove from `web/package.json`:

- `@coral-xyz/anchor`
- `@solana/web3.js`
- `@solana/wallet-adapter-base`
- `@solana/wallet-adapter-react`
- `@solana/wallet-adapter-react-ui`
- `@solana/wallet-adapter-wallets`

Keep in root `package.json`:

- `@coral-xyz/anchor` — still needed for scripts/ and tests/

## What NOT to migrate

- `scripts/*.ts` — these run in Node, bundle size doesn't matter, Anchor DX is fine
- `tests/*.ts` — same reasoning
- `migrations/deploy.ts` — Anchor native

## Risk Notes

- Wallet Standard support: Phantom and Solflare both support wallet-standard, so the new `@solana/react-hooks` will discover them. Verify this works before removing wallet-adapter.
- The `WalletMultiButton` UI from wallet-adapter-react-ui has no direct equivalent in `@solana/react-hooks` — you'll need a simple custom connect/disconnect button.
- `getProgramAccounts` with memcmp filters works the same way in Kit, but the filter syntax is slightly different (offset + bytes as Uint8Array instead of base58 string).

