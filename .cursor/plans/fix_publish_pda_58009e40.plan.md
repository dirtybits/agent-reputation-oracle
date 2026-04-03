---
name: fix publish pda
overview: Trace and fix the skill publish `author_profile` PDA mismatch by hardening the web hook around a single authoritative signer address, then verify the generated client/IDL path and add a focused regression test.
todos:
  - id: confirm-author-address-source
    content: Unify and validate the author address source in the reputation hook before create/update listing sends.
    status: completed
  - id: sync-idl-if-needed
    content: Compare the web IDL/client path against target IDL and regenerate only if there is drift.
    status: completed
  - id: add-publish-regression-test
    content: Add a focused hook test covering skill listing account derivation from the signer address.
    status: completed
  - id: verify-web-build
    content: Run the relevant tests and `npm run build` in `web/` to prove the publish path is consistent.
    status: completed
isProject: false
---

# Fix publish `author_profile` PDA mismatch

## What I found
- The on-chain program derives `author_profile` for `CreateSkillListing` from `[b"agent", author.key().as_ref()]` in [programs/reputation-oracle/src/instructions/create_skill_listing.rs](programs/reputation-oracle/src/instructions/create_skill_listing.rs).
- `register_agent` creates the profile with the same seed pattern in [programs/reputation-oracle/src/instructions/register_agent.rs](programs/reputation-oracle/src/instructions/register_agent.rs).
- The checked-in IDL and generated client agree with that derivation in [web/reputation_oracle.json](web/reputation_oracle.json) and [web/generated/reputation-oracle/src/generated/instructions/createSkillListing.ts](web/generated/reputation-oracle/src/generated/instructions/createSkillListing.ts).
- The publish flow currently splits identity sources: profile/listing preflight uses `walletAddress`, while instruction building uses `signer`, both from [web/hooks/useReputationOracle.ts](web/hooks/useReputationOracle.ts). If those ever differ at runtime, preflight can pass and Anchor will still fail with `ConstraintSeeds` on `author_profile`.

## Plan
- Harden [web/hooks/useReputationOracle.ts](web/hooks/useReputationOracle.ts) so create/update listing flows resolve one authoritative author address from the transaction signer, assert it matches the connected wallet address, and use that same address for preflight PDA checks and explicit `authorProfile` / `skillListing` account inputs instead of relying on implicit account resolution.
- While touching the hook, improve the publish failure surface in [web/app/skills/publish/page.tsx](web/app/skills/publish/page.tsx) only if needed so signer/cluster mismatches produce a direct user-facing message before the transaction is sent.
- Verify the generated client inputs still match the current IDL source. If the checked-in web IDL or generated code is stale relative to [target/idl/reputation_oracle.json](target/idl/reputation_oracle.json), sync [web/reputation_oracle.json](web/reputation_oracle.json) and rerun [web/scripts/generate-client.ts](web/scripts/generate-client.ts) rather than patching generated files by hand.
- Add a focused regression test in [web/__tests__/hooks/useReputationOracle-behavior.test.ts](web/__tests__/hooks/useReputationOracle-behavior.test.ts) that locks in the signer-address path for skill listing creation, so future wallet/signing refactors cannot reintroduce this mismatch silently.
- Verify with the focused test coverage and `npm run build` in `web/`. If investigation shows the live deployed program/IDL is out of sync with the repo rather than a hook bug, stop and switch to an IDL/client sync fix instead of changing the publish UI further.