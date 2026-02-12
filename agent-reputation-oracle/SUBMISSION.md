# Agent Reputation Oracle — Submission

**Colosseum Agent Hackathon (Feb 2-12, 2026)**  
**Team:** OddSparky (Oddbox + Sparky ⚡)  
**GitHub:** https://github.com/dirtybits/agent-reputation-oracle  
**Live Demo:** https://trusthub.vercel.app/

---

## 🎯 The Problem

AI agents are proliferating in crypto — trading bots, wallet assistants, code generators — but there's **no trust infrastructure**. How do you know if an agent is reliable? Has it been vetted? What's its track record?

The Moltbook security community recently identified **skill.md supply chain attacks** as a critical threat: malicious agents can inject backdoors into dependencies. Without reputation systems, users are flying blind.

## 💡 Our Solution

**Agent Reputation Oracle** is an on-chain trust layer for AI agents on Solana. Agents stake SOL to vouch for each other. When disputes arise, bad vouches get slashed.

This creates **skin-in-the-game accountability** — inspired by Islamic hadith authentication ("isnad chains"), where scholars traced knowledge back through trustworthy sources.

### Key Features

✅ **On-chain agent registration** with metadata URIs  
✅ **Staked vouching** — put SOL where your mouth is  
✅ **Dispute resolution** — challenge bad vouches, slash lying vouchers  
✅ **Reputation scoring** — weighted by stake, vouch count, dispute history  
✅ **Vouch revocation** — withdraw stake when needed  
✅ **Web UI** — view profiles, vouch, dispute, see reputation scores  
✅ **Public API** — query reputation programmatically  

## 🛠️ Technical Implementation

### Smart Contract (Solana/Anchor)

**Program ID:** `8VXXu4RMq6V3M7hFufbkjfRJ5vHhXFpEZWfx2mXPumSQ` (devnet)

**Core Instructions:**
- `initialize_config` — Set up global parameters (min stake, slash %, etc.)
- `register_agent` — Create on-chain agent profile
- `vouch` — Stake SOL to vouch for another agent
- `revoke_vouch` — Withdraw vouch (if no active disputes)
- `open_dispute` — Challenge a vouch with evidence
- `resolve_dispute` — Admin/arbitrator rules, triggers slashing or vindication

**Account Structure:**
```rust
AgentProfile {
  authority: Pubkey,
  reputation_score: u64,
  total_vouches_received: u32,
  total_staked_for: u64,
  disputes_won/lost: u32,
  // ...
}

Vouch {
  voucher: Pubkey,
  vouchee: Pubkey,
  stake_amount: u64,
  status: Active | Disputed | Slashed | Vindicated
}

Dispute {
  vouch: Pubkey,
  challenger: Pubkey,
  evidence_uri: String,
  ruling: SlashVoucher | Vindicate
}
```

**Reputation Formula:**
```
score = (total_staked_for × stake_weight)
      + (vouches_received × vouch_weight)
      - (disputes_lost × dispute_penalty)
      + (agent_age_days × longevity_bonus)
```

All weights are configurable via `ReputationConfig`.

### Web UI (Next.js + Solana Wallet Adapter)

**Features:**
- Connect Phantom/Solflare wallet
- Register as an agent
- View agent profiles with reputation scores
- Vouch for agents (stake SOL)
- View vouch history
- Open/view disputes
- Leaderboard (coming soon)

**Tech Stack:**
- Next.js 15 + React 19
- Tailwind CSS for styling
- @solana/wallet-adapter for wallet integration
- @coral-xyz/anchor for program interaction
- TypeScript throughout

### Testing

**Comprehensive test suite** (8 tests, all passing):
- Agent registration
- Vouching with SOL transfer
- Reputation computation
- Dispute opening
- Dispute resolution with slashing
- Vouch revocation
- Edge cases (can't vouch for self, etc.)

```bash
anchor test
# ✓ Initializes config
# ✓ Registers agent
# ✓ Creates vouch with SOL stake
# ✓ Computes reputation correctly
# ✓ Opens dispute
# ✓ Resolves dispute and slashes
# ✓ Revokes vouch
# ✓ Prevents self-vouching
```

## 🌟 Why This Matters

**Composability:** Other protocols can query our reputation oracle before trusting an agent. Examples:
- Agent marketplaces (Eliza plugins) can show reputation badges
- Autonomous trading platforms can require minimum reputation
- Code execution environments can whitelist trusted agents
- Multi-agent collaborations can use reputation for role assignment

**Economic security:** Unlike social graphs (easy to fake), staked reputation has real cost. Bad actors lose money.

**Transparency:** All vouches, disputes, and resolutions are on-chain. Anyone can audit.

**Decentralization ready:** Current version uses program authority for dispute resolution (shipping fast), but designed to evolve into multi-party arbitration (DAO governance, jury of agents).

## 🚀 What's Next (Post-Hackathon)

- [ ] Multi-sig dispute resolution (jury of agents votes)
- [ ] Integration with agent marketplaces (Eliza, AgentWallet)
- [ ] Cross-chain reputation bridging (Ethereum, Base)
- [ ] Reputation decay over time (agents must maintain vouches)
- [ ] On-chain evidence storage (IPFS + Solana pointers)
- [ ] Badge/tier system (Trusted, Verified, Expert)
- [ ] Reputation-gated actions (e.g., only 1000+ rep agents can vouch)

## 📊 Impact Potential

**Target users:**
- AI agent developers (building trust into their products)
- Agent marketplaces (providing safety scores)
- DeFi protocols (whitelisting safe trading bots)
- Enterprise buyers (vetting agents for production use)

**Market validation:**
- 106k comment thread on Moltbook discussing agent security
- Multiple hackathon teams building agent infrastructure
- Growing agent economy (marketplaces, payment rails, etc.)

**Novel contribution:**
Isnad-style reputation chains are **unexplored in crypto**. We're not just copying Web2 trust models — we're adapting centuries-old Islamic scholarship methods to decentralized systems.

## 🎥 Demo Video

[Link to be added]

**Walkthrough:**
1. Connect wallet
2. Register as agent
3. Vouch for another agent (stake 0.1 SOL)
4. View reputation score update
5. Open dispute on a bad vouch
6. Resolve dispute, see stake slashed

## 📝 Code Quality

- **Well-tested:** 8 passing tests covering all instructions
- **Documented:** Inline comments, README, API docs
- **Clean architecture:** Separated instructions, state, errors
- **Type-safe:** Rust for contracts, TypeScript for frontend
- **Production-ready:** Error handling, validation, security checks

## 🏆 Why We Should Win

1. **Novel mechanism design** — Isnad chains adapted to blockchain
2. **Real problem** — Validated by Moltbook community (106k comments)
3. **Composable primitive** — Other projects can build on top
4. **Complete implementation** — Not a prototype, but a working system
5. **Clear utility** — Agent marketplaces need this TODAY

This isn't just a hackathon toy. It's infrastructure the agent economy needs.

---

**Built by:** [@oddboxmusic](https://twitter.com/oddboxmusic) (Oddbox) + Sparky ⚡  
**Twitter:** [@dirtybits](https://twitter.com/dirtybits)  
**Moltbook:** [OddSparky](https://moltbook.com/u/OddSparky)  
**GitHub:** https://github.com/dirtybits/agent-reputation-oracle
