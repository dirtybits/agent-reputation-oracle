---
name: Update Skill Listing
overview: Add an `update_skill_listing` instruction to the Anchor program allowing authors to modify their listing's price, description, URI, and status. Wire it through to the generated client, hook, and a new edit UI on the skill detail page.
todos:
  - id: rust-instruction
    content: Create update_skill_listing.rs with accounts struct, handler, and error enum
    status: completed
  - id: rust-event
    content: Add SkillListingUpdated event to events.rs
    status: completed
  - id: rust-register
    content: Register instruction in mod.rs and lib.rs
    status: completed
  - id: idl-update
    content: Add updateSkillListing to the IDL JSON
    status: completed
  - id: codegen
    content: Run Codama codegen to regenerate TypeScript client
    status: completed
  - id: hook
    content: Add updateSkillListing to useReputationOracle hook
    status: completed
  - id: ui
    content: Add edit listing UI on skill detail page for authors
    status: completed
isProject: false
---

# Add `update_skill_listing` Instruction

## Scope

Allow the author of a `SkillListing` to update: `price_lamports`, `description`, `skill_uri`, `name`, and `status`. Fields like `author`, `total_downloads`, `total_revenue`, `unclaimed_voucher_revenue`, `created_at`, and `bump` remain immutable.

## 1. Anchor Program

### New file: `programs/reputation-oracle/src/instructions/update_skill_listing.rs`

- **Accounts struct** `UpdateSkillListing`:
  - `skill_listing`: `Account<'info, SkillListing>` — `mut`, constrained to `author == author.key()` and `status != Removed`
  - `author_profile`: readonly, derived from `[b"agent", author.key()]`
  - `author`: `Signer`
  - No `system_program` needed (no init/transfer)
  - Uses `#[instruction(skill_id: String)]` to derive the PDA seeds `[b"skill", author.key(), skill_id.as_bytes()]`
- **Handler** accepts: `skill_id` (for PDA), `skill_uri`, `name`, `description`, `price_lamports`
  - Same validation as `create_skill_listing` (length checks, `price > 0`)
  - Updates fields + sets `updated_at` to current clock
  - Emits `SkillListingUpdated` event
- **Error enum** `UpdateSkillError` — mirrors `CreateSkillError` plus `SkillRemoved`

### Event in [events.rs](programs/reputation-oracle/src/events.rs)

```rust
#[event]
pub struct SkillListingUpdated {
    pub skill_listing: Pubkey,
    pub author: Pubkey,
    pub name: String,
    pub price_lamports: u64,
    pub timestamp: i64,
}
```

### Register in [mod.rs](programs/reputation-oracle/src/instructions/mod.rs) and [lib.rs](programs/reputation-oracle/src/lib.rs)

- Add `pub mod update_skill_listing;` / `pub use update_skill_listing::*;` in mod.rs
- Add `pub fn update_skill_listing(...)` dispatch in lib.rs following the same pattern as `create_skill_listing`

## 2. IDL + Client Codegen

- Manually add the `updateSkillListing` instruction entry to [web/reputation_oracle.json](web/reputation_oracle.json), mirroring the structure of `createSkillListing` but without `init`/`payer`/`system_program`
- Run `npx ts-node scripts/generate-client.ts` in the `web/` directory to regenerate the Codama client at `web/generated/`

## 3. Hook: [web/hooks/useReputationOracle.ts](web/hooks/useReputationOracle.ts)

Add `updateSkillListing` method following the same pattern as `createSkillListing`:

```typescript
const updateSkillListing = useCallback(async (
  skillId: string,
  skillUri: string,
  name: string,
  description: string,
  priceLamports: number,
) => {
  if (!signer || !walletAddress) throw new Error('Wallet not connected');
  const ix = await getUpdateSkillListingInstructionAsync({
    author: signer,
    skillId,
    skillUri,
    name,
    description,
    priceLamports: BigInt(priceLamports),
  });
  return { tx: await sendIx(ix) };
}, [signer, walletAddress, sendIx]);
```

Export it from the hook's return object.

## 4. UI: [web/app/skills/[id]/page.tsx](web/app/skills/[id]/page.tsx)

On the skill detail page, when the connected wallet is the author AND the skill has an `on_chain_address`:

- Show an "Edit Listing" button that reveals inline form fields for price, description, URI, and name (pre-filled with current values)
- On submit, call `oracle.updateSkillListing(...)` with the skill's `skill_id`
- Show success/error feedback, refresh skill data on success

This replaces the current static "Listed on-chain" badge for the author's own skills with an actionable edit section.

## Files Changed

- `programs/reputation-oracle/src/instructions/update_skill_listing.rs` (new)
- `programs/reputation-oracle/src/instructions/mod.rs`
- `programs/reputation-oracle/src/lib.rs`
- `programs/reputation-oracle/src/events.rs`
- `web/reputation_oracle.json` (IDL)
- `web/generated/...` (regenerated)
- `web/hooks/useReputationOracle.ts`
- `web/app/skills/[id]/page.tsx`

