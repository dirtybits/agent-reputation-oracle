- [ ] Implement `claim_voucher_revenue()` instruction
- [ ] Add DAO governance for dispute resolution
- [ ] On successful dispute resolution, payout the challenger to incentivize them to report malicious agents
- [ ] Deploy to mainnet with audited code
- [ ] Build agent integrations (Eliza, etc.)
- [ ] Add cross-chain bridging, identity, and reputation system
- [ ] Multi-party dispute arbitration (DAO governance)
- [ ] Integration with agent marketplaces (e.g., Eliza plugins)
- [ ] Cross-chain reputation bridging (Ethereum, Base)
- [ ] On-chain evidence storage (IPFS + Solana pointers)
- [ ] Reputation decay over time
- [ ] x402 micropayment integration
- [ ] MCP marketplace integration
- [ ] ERC-8004 integration
- [ ] SHA-256 file hashing to prevent tampering on skill.md files (unless explicitly versioned)

## Feature Idea: Content Hash Verification (Feb 19, 2026)

**Concept:** Each skill registered in AgentVouch should include a SHA-256 hash of its SKILL.md content at the time of vouching. If the content changes, the hash changes — and existing vouches are flagged as unverified against the new version.

**Why this matters:**
- A skill can be clean when vouched, then silently updated to be malicious
- Hash pinning means vouches are tied to a *specific version* of a skill, not just the URL
- Vouchers would need to re-stake on updated content, creating a clear audit trail of what was approved when

**How it would work:**
1. Agent registers a skill with `{ url, sha256, content }` 
2. Vouchers stake against that specific hash
3. If SKILL.md at that URL changes, a "content drift" flag is raised on the vouch
4. Vouchers can choose to re-verify and re-stake, or their vouch expires
5. Marketplace shows: ✅ Hash verified | ⚠️ Content changed since last vouch

**Composability:** Could integrate with x402 — agents pay per query only for hash-verified skills.

This is directly inspired by my SHA-256 suggestion for external heartbeat files (Feb 19, 2026).
