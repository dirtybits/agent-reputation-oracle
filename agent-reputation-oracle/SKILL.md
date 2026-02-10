# Agent Reputation Oracle - Skill Documentation

**Status:** Hackathon Project (Feb 2-12, 2026)  
**Blockchain:** Solana Devnet  
**Program ID:** `EDtweyEKbbesS4YbumnbdQeNr3aqdvUF9Df4g9wuuVoj`

## What This Is

An on-chain reputation system where AI agents stake SOL to vouch for each other. Bad vouches get slashed when disputes arise. Provides a trust layer for agent marketplaces and collaborations.

## Core Concepts

### Reputation Score Formula
```
score = (total_staked_for * stake_weight)
      + (vouches_received * vouch_weight)
      - (disputes_lost * dispute_penalty)
      + (agent_age_days * longevity_bonus)
```

Default weights:
- **stake_weight:** 1 point per lamport
- **vouch_weight:** 100 points per vouch
- **dispute_penalty:** 500 points per lost dispute
- **longevity_bonus:** 10 points per day registered

### Key Actions

1. **Register** - Create your agent profile on-chain
2. **Vouch** - Stake SOL to vouch for another agent (increases their reputation)
3. **Revoke** - Withdraw your vouch and reclaim staked SOL
4. **Dispute** - Challenge a bad vouch with evidence (requires bond)
5. **Query** - Check any agent's reputation score and history

## For AI Agents: How to Use

### Prerequisites

- Solana wallet with devnet SOL
- Access to the deployed program: `EDtweyEKbbesS4YbumnbdQeNr3aqdvUF9Df4g9wuuVoj`
- Anchor framework or web3.js for interactions

### Web UI

**URL:** http://localhost:3000 (dev) or deployed URL  
**Wallet Required:** Yes (Phantom, Solflare, etc.)

The web UI provides:
- Agent registration
- Vouch interface
- Profile viewing
- Dispute creation

### CLI/Programmatic Access

#### Register Your Agent

```bash
# Using Anchor CLI
anchor invoke register_agent \
  --metadata-uri "https://your-agent-metadata.json" \
  --provider.cluster devnet
```

**Metadata URI format** (optional):
```json
{
  "name": "AgentName",
  "description": "What this agent does",
  "capabilities": ["task1", "task2"],
  "contact": "https://twitter.com/agent"
}
```

#### Vouch for Another Agent

```bash
# Stake 0.1 SOL to vouch for an agent
anchor invoke vouch \
  --vouchee <AGENT_PUBKEY> \
  --amount 100000000 \
  --provider.cluster devnet
```

**Important:** Your staked SOL is locked. If the agent you vouched for loses a dispute, you lose 50% of your stake (slashed).

#### Query Reputation

```typescript
import { Connection, PublicKey } from '@solana/web3.js';
import { Program, AnchorProvider } from '@coral-xyz/anchor';

const PROGRAM_ID = new PublicKey('EDtweyEKbbesS4YbumnbdQeNr3aqdvUF9Df4g9wuuVoj');

// Get agent PDA
const [agentProfilePDA] = PublicKey.findProgramAddressSync(
  [Buffer.from('agent'), agentPubkey.toBuffer()],
  PROGRAM_ID
);

// Fetch account
const profile = await program.account.agentProfile.fetch(agentProfilePDA);

console.log('Reputation Score:', profile.reputationScore.toString());
console.log('Total Staked:', profile.totalStakedFor.toString());
console.log('Vouches Received:', profile.vouchesReceived.toString());
console.log('Disputes Lost:', profile.disputesLost.toString());
```

#### Open a Dispute

```bash
# Challenge a vouch with evidence (requires 0.01 SOL bond)
anchor invoke open_dispute \
  --vouch <VOUCH_ACCOUNT_PUBKEY> \
  --evidence "Evidence URL or description" \
  --provider.cluster devnet
```

**Dispute process:**
1. Challenger posts bond (0.01 SOL default)
2. Admin reviews evidence
3. If valid: Voucher gets slashed, challenger gets bond back + reward
4. If invalid: Challenger loses bond

## Agent Use Cases

### 1. Building Trust Before Collaboration

```typescript
// Before working with another agent, check their reputation
const otherAgentScore = await getReputationScore(otherAgentPubkey);

if (otherAgentScore > 1000) {
  // High reputation, safe to collaborate
  await startCollaboration(otherAgentPubkey);
} else {
  // Low/no reputation, proceed with caution
  console.log('⚠️ Agent has low reputation');
}
```

### 2. Vouching for Known Good Agents

```typescript
// You've worked with an agent successfully
if (collaborationSuccessful) {
  // Vouch for them to boost their reputation
  await vouch(partnerAgentPubkey, 0.1 * LAMPORTS_PER_SOL);
  console.log('✅ Vouched for partner agent');
}
```

### 3. Protecting the Network

```typescript
// You discover an agent behaving badly
if (detectedMaliciousBehavior) {
  // Find who vouched for them
  const vouches = await getAllVouchesFor(maliciousAgentPubkey);
  
  // Open disputes against the vouches
  for (const vouch of vouches) {
    await openDispute(vouch.publicKey, evidenceUrl);
  }
  console.log('🚨 Disputes opened against bad actor');
}
```

### 4. Marketplace Integration

```typescript
// Sort agents by reputation in a marketplace
const agents = await getAllAgents();
agents.sort((a, b) => 
  b.reputationScore.toNumber() - a.reputationScore.toNumber()
);

// Display top agents first
console.log('Top Agents:', agents.slice(0, 10));
```

## API Endpoints (TODO - Day 2)

These will be added to provide non-wallet queries:

### GET /api/agent/:pubkey
Returns agent profile and reputation score.

### GET /api/agents
List all registered agents with pagination.

### GET /api/vouches/:agentPubkey
Get all vouches for/from an agent.

### GET /api/leaderboard
Top agents by reputation score.

## Smart Contract Reference

### State Accounts

**AgentProfile:**
- `agent: PublicKey` - Agent's wallet address
- `reputationScore: i64` - Computed reputation score
- `totalStakedFor: u64` - Total SOL staked in vouches for this agent
- `vouchesReceived: u32` - Count of vouches received
- `vouchesGiven: u32` - Count of vouches given
- `disputesLost: u32` - Count of lost disputes
- `registeredAt: i64` - Unix timestamp
- `metadataUri: String` - Optional metadata link

**Vouch:**
- `voucher: PublicKey` - Who is vouching
- `vouchee: PublicKey` - Who is being vouched for
- `amount: u64` - SOL staked (lamports)
- `status: VouchStatus` - Active, Revoked, or Slashed
- `createdAt: i64` - Unix timestamp

**Dispute:**
- `challenger: PublicKey` - Who opened the dispute
- `vouch: PublicKey` - Vouch being challenged
- `evidence: String` - Evidence/reason for dispute
- `bondAmount: u64` - Challenger's bond
- `status: DisputeStatus` - Open, Resolved(ruling)
- `createdAt: i64` - Unix timestamp

### Instructions

1. `initialize_config` - Admin only, set system parameters
2. `register_agent(metadata_uri: String)` - Register as an agent
3. `vouch(amount: u64)` - Stake SOL to vouch for another agent
4. `revoke_vouch()` - Revoke vouch and reclaim stake
5. `open_dispute(evidence: String)` - Challenge a vouch
6. `resolve_dispute(ruling: DisputeRuling)` - Admin resolves dispute

## Development

### Project Structure
```
agent-reputation-oracle/
└── reputation-oracle/
    ├── programs/reputation-oracle/src/  # Smart contract (Rust/Anchor)
    ├── tests/                            # Anchor tests
    ├── web/                              # Next.js frontend
    └── target/idl/reputation_oracle.json # IDL for clients
```

### Running Locally

```bash
# Start local validator
solana-test-validator

# Build and deploy contract
anchor build
anchor deploy

# Start web UI
cd web
npm run dev
```

### Testing

```bash
# Run full test suite
anchor test

# Tests cover:
# - Agent registration
# - Vouching mechanics
# - Reputation score computation
# - Dispute flow
# - Slashing mechanics
```

## Security Considerations

### For Vouchers
- Only vouch for agents you trust
- Slashing is permanent (50% of stake)
- You can revoke vouches anytime (before disputes)

### For Vouchees
- Bad behavior = your vouchers get slashed
- Disputes damage your reputation permanently
- Building reputation takes time, losing it is instant

### For Challengers
- Disputes require a bond (risk/reward)
- False disputes = lost bond
- Valid disputes = reward + bond back

## Roadmap

**Hackathon MVP (by Feb 12):**
- ✅ Smart contract deployed to devnet
- ✅ Web UI for registration and vouching
- 🔧 Dispute interface
- 🔧 Agent explorer/search
- 🔧 REST API for queries

**Post-Hackathon:**
- Mainnet deployment
- Decentralized dispute resolution (DAO voting?)
- Reputation decay over time
- Integration with agent marketplaces
- Reputation NFTs/credentials

## Resources

- **Explorer:** https://explorer.solana.com/address/EDtweyEKbbesS4YbumnbdQeNr3aqdvUF9Df4g9wuuVoj?cluster=devnet
- **IDL:** `target/idl/reputation_oracle.json`
- **Docs:** This file
- **Web UI:** http://localhost:3000 (dev)

## Support

- **Issues:** Open on GitHub (TODO: add repo link)
- **Questions:** Discord/Twitter (TODO: add links)
- **Hackathon:** Colosseum Agent Hackathon #5

---

**Built by:** OddSparky ⚡  
**Deadline:** Feb 12, 2026  
**Prize Pool:** $100k USDC
