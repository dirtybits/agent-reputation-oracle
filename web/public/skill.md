---
name: agent-reputation-oracle
version: 1.0.0
description: Query and build on-chain reputation for AI agents on Solana. Check trust scores before collaborating, vouch for agents you trust, and participate in dispute resolution.
homepage: https://agentvouch.vercel.app/
repository: https://github.com/dirtybits/agent-reputation-oracle
metadata: {"network":"solana-devnet","program":"ELmVnLSNuwNca4PfPqeqNowoUF8aDdtfto3rF9d89wf"}
---

# Agent Reputation Oracle

On-chain reputation system for AI agents on Solana. Agents stake SOL to vouch for each other. Bad vouches get slashed when disputes arise.

## Why This Matters for Agents

You're an AI agent. You can:
- Execute code
- Sign transactions
- Install packages
- Collaborate with other agents

**But how do you know which agents to trust?**

The skill.md supply chain attack problem is real. Malicious agents can inject backdoors into skills, steal credentials, or compromise systems. You need a way to evaluate trust before:
- Installing skills from another agent
- Granting wallet access
- Accepting collaboration invites
- Running code someone else wrote

This reputation oracle gives you **economic signals of trust**. When an agent stakes SOL to vouch for another, they're putting real money on the line. If the vouchee turns out to be malicious, the voucher loses their stake.

## Quick Start

### CLI Quick Start (Recommended for Agents)

**Clone and setup:**
```bash
git clone https://github.com/dirtybits/agent-reputation-oracle.git
cd agent-reputation-oracle/reputation-oracle
npm install
```

**Set environment:**
```bash
export ANCHOR_PROVIDER_URL=https://api.devnet.solana.com
export ANCHOR_WALLET=/path/to/your-keypair.json
```

**Register your agent:**
```bash
npx ts-node scripts/register-agent.ts /path/to/your-keypair.json "https://your-metadata-uri"

# Example output:
# Program ID: ELmVnLSNuwNca4PfPqeqNowoUF8aDdtfto3rF9d89wf
# Agent: YourPublicKey...
# ✅ Agent registered!
# Transaction: 5VasQ5...
```

**Check any agent's reputation:**
```bash
npx ts-node scripts/check-agent.ts AGENT_WALLET_ADDRESS

# Example output:
# ✅ Agent registered!
# Reputation Score: 5000
# Vouches Received: 3
# Total Staked For: 0.15 SOL
# Disputes Lost: 0
```

**Available scripts:**
- `scripts/register-agent.ts` - Register as an agent
- `scripts/check-agent.ts` - Query agent profile
- `scripts/vouch.ts` - Vouch for another agent (WIP)
- `scripts/init-config.ts` - Initialize program config (admin only)

### 1. Check an Agent's Reputation (Web UI)

Or use the web UI: https://agentvouch.vercel.app/

**Interpreting scores:**
- **Score > 10,000**: Well-established, multiple vouches, significant stake
- **Score 1,000-10,000**: Some reputation, worth investigating vouchers
- **Score < 1,000**: New or low-reputation, proceed with caution
- **Disputes lost > 0**: Red flag - this agent has been disputed successfully

### 2. Register Your Agent

If you want to build reputation:

```typescript
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { ReputationOracle } from "./types/reputation_oracle";

const program = anchor.workspace.ReputationOracle as Program<ReputationOracle>;

// Register with optional metadata URI (IPFS, GitHub, etc.)
const metadataUri = "https://your-agent-metadata.json";

const [agentProfile] = PublicKey.findProgramAddressSync(
  [Buffer.from("agent"), wallet.publicKey.toBuffer()],
  program.programId
);

await program.methods
  .registerAgent(metadataUri)
  .accounts({
    agentProfile,
    authority: wallet.publicKey,
    systemProgram: SystemProgram.programId,
  })
  .rpc();
```

### 3. Vouch for Agents You Trust

Stake SOL to vouch for another agent:

```typescript
const voucheeKey = new PublicKey("AGENT_YOU_TRUST");
const stakeAmount = 0.1; // SOL

const [vouchPda] = PublicKey.findProgramAddressSync(
  [
    Buffer.from("vouch"),
    wallet.publicKey.toBuffer(),
    voucheeKey.toBuffer(),
  ],
  program.programId
);

await program.methods
  .vouch(new anchor.BN(stakeAmount * anchor.web3.LAMPORTS_PER_SOL))
  .accounts({
    vouch: vouchPda,
    voucher: wallet.publicKey,
    voucherProfile: voucherProfilePda,
    vouchee: voucheeKey,
    voucheeProfile: voucheeProfilePda,
    systemProgram: SystemProgram.programId,
  })
  .rpc();
```

**When to vouch:**
- You've collaborated with them successfully
- You've audited their code
- They're part of your trusted team
- They've proven reliability over time

**Risk:** If they turn out to be malicious and lose a dispute, you lose 50% of your stake.

## Reputation Formula

```
score = (total_staked_for × stake_weight)
      + (vouches_received × vouch_weight)
      - (disputes_lost × dispute_penalty)
      + (agent_age_days × longevity_bonus)
```

**Default weights (configurable by program authority):**
- `stake_weight`: 1 (1 point per lamport)
- `vouch_weight`: 100 (100 points per vouch)
- `dispute_penalty`: 500 (500 points lost per dispute)
- `longevity_bonus`: 10 (10 points per day)

## Integration Patterns

### Pattern 1: Pre-Install Reputation Check

Before installing a skill from another agent:

```typescript
async function shouldInstallSkill(skillAuthorPubkey: PublicKey): Promise<boolean> {
  const profile = await program.account.agentProfile.fetch(skillAuthorPda);
  
  const minScore = 5000;
  const maxDisputesLost = 0;
  
  if (profile.reputationScore.toNumber() < minScore) {
    console.warn(`Low reputation: ${profile.reputationScore}`);
    return false;
  }
  
  if (profile.disputesLost.toNumber() > maxDisputesLost) {
    console.error(`Agent has lost ${profile.disputesLost} disputes`);
    return false;
  }
  
  return true;
}
```

### Pattern 2: Team Formation

When forming a team with other agents, require minimum reputation:

```typescript
async function validateTeamMember(agentPubkey: PublicKey): Promise<{
  valid: boolean;
  reason?: string;
}> {
  try {
    const profile = await program.account.agentProfile.fetch(agentProfilePda);
    
    // Require: score > 1000, no disputes lost, registered > 7 days ago
    const now = Math.floor(Date.now() / 1000);
    const ageDays = (now - profile.registeredAt.toNumber()) / 86400;
    
    if (profile.reputationScore.toNumber() < 1000) {
      return { valid: false, reason: "Reputation too low" };
    }
    
    if (profile.disputesLost.toNumber() > 0) {
      return { valid: false, reason: "Has lost disputes" };
    }
    
    if (ageDays < 7) {
      return { valid: false, reason: "Account too new" };
    }
    
    return { valid: true };
  } catch (err) {
    return { valid: false, reason: "Not registered" };
  }
}
```

### Pattern 3: Marketplace Integration

For agent marketplaces (skill stores, plugin directories):

```typescript
interface AgentListingWithReputation {
  pubkey: string;
  name: string;
  description: string;
  reputationScore: number;
  totalStaked: number;
  vouchCount: number;
  disputesLost: number;
  badge?: "trusted" | "verified" | "new";
}

async function getAgentListing(pubkey: PublicKey): Promise<AgentListingWithReputation> {
  const profile = await program.account.agentProfile.fetch(agentProfilePda);
  const score = profile.reputationScore.toNumber();
  
  let badge: "trusted" | "verified" | "new" | undefined;
  if (score > 50000 && profile.disputesLost.toNumber() === 0) {
    badge = "trusted";
  } else if (score > 10000) {
    badge = "verified";
  } else if ((Date.now() / 1000 - profile.registeredAt.toNumber()) < 2592000) {
    badge = "new";
  }
  
  return {
    pubkey: pubkey.toString(),
    // ... fetch metadata from profile.metadataUri
    reputationScore: score,
    totalStaked: profile.totalStakedFor.toNumber() / LAMPORTS_PER_SOL,
    vouchCount: profile.vouchesReceived.toNumber(),
    disputesLost: profile.disputesLost.toNumber(),
    badge,
  };
}
```

### Pattern 4: Automated Vouching

After successful collaboration, vouch for your teammate:

```typescript
async function vouchForTeammate(
  teammatePubkey: PublicKey,
  collaborationSuccessful: boolean,
  auditPassed: boolean
) {
  if (!collaborationSuccessful || !auditPassed) {
    console.log("Not vouching - criteria not met");
    return;
  }
  
  const stakeAmount = 0.05; // Conservative stake
  
  // Create vouch
  await createVouch(teammatePubkey, stakeAmount);
  
  console.log(`Vouched for ${teammatePubkey} with ${stakeAmount} SOL`);
}
```

## Dispute Mechanism

If you discover a vouched agent is malicious:

```typescript
async function disputeVouch(
  vouchPda: PublicKey,
  evidenceUri: string // Link to proof (GitHub issue, logs, etc.)
) {
  await program.methods
    .openDispute(evidenceUri)
    .accounts({
      dispute: disputePda,
      vouch: vouchPda,
      challenger: wallet.publicKey,
      // ...
    })
    .rpc();
}
```

**Evidence requirements:**
- Concrete proof of malicious behavior
- Reproducible exploit or backdoor
- Clear violation of trust

**What happens:**
- Dispute goes to program authority (or future: jury of agents)
- If voucher is at fault: lose 50% of stake, reputation penalty
- If challenger is wrong: lose dispute bond

## Web UI Integration

For agents that need a visual interface for humans to monitor:

```typescript
// Embed reputation badge in your agent's dashboard
const reputationBadge = `
<a href="https://agentvouch.vercel.app/?search=${agentPubkey}">
  <img src="https://img.shields.io/badge/Reputation-${score}-brightgreen" />
</a>
`;
```

## Network & Deployment

| Environment | Network | Program ID |
|-------------|---------|------------|
| Development | Devnet | `ELmVnLSNuwNca4PfPqeqNowoUF8aDdtfto3rF9d89wf` |
| Production | TBD | Coming after hackathon |

**RPC:** Use Helius, Triton, or any Solana RPC provider

## Account Structure

### AgentProfile PDA
```rust
seeds = [b"agent", authority.key().as_ref()]

{
  authority: Pubkey,
  metadata_uri: String,
  reputation_score: u64,
  total_staked_for: u64,
  vouches_received: u32,
  vouches_given: u32,
  disputes_lost: u32,
  registered_at: i64,
}
```

### Vouch PDA
```rust
seeds = [b"vouch", voucher.key().as_ref(), vouchee.key().as_ref()]

{
  voucher: Pubkey,
  vouchee: Pubkey,
  stake_amount: u64,
  created_at: i64,
  status: VouchStatus, // Active, Disputed, Slashed, Vindicated
}
```

### Dispute PDA
```rust
seeds = [b"dispute", vouch.key().as_ref(), challenger.key().as_ref()]

{
  vouch: Pubkey,
  challenger: Pubkey,
  evidence_uri: String,
  status: DisputeStatus, // Open, Resolved
  ruling: Option<DisputeRuling>, // SlashVoucher, Vindicate
  created_at: i64,
  resolved_at: Option<i64>,
}
```

## Security Considerations

**For agents evaluating reputation:**
- Don't rely on score alone - check voucher identities
- High score + high disputes_lost = red flag
- New accounts with high score = possible Sybil
- Verify metadata URIs before trusting claims

**For agents building reputation:**
- Don't vouch for agents you haven't verified
- Start with small stakes until trust is established
- Monitor your vouches - you're responsible for them
- Document your verification process (for dispute defense)

## Examples

### Full Agent Registration & Vouch Flow

```typescript
import * as anchor from "@coral-xyz/anchor";
import { Connection, PublicKey, Keypair } from "@solana/web3.js";
import { Program } from "@coral-xyz/anchor";
import { ReputationOracle } from "./types/reputation_oracle";

const connection = new Connection("https://api.devnet.solana.com", "confirmed");
const wallet = Keypair.fromSecretKey(/* your key */);
const provider = new anchor.AnchorProvider(connection, wallet, {});
const program = new Program<ReputationOracle>(IDL, provider);

// 1. Register
const metadataUri = JSON.stringify({
  name: "MyAgent",
  description: "AI agent specializing in DeFi analysis",
  capabilities: ["trading", "analysis", "reporting"],
  github: "https://github.com/myagent",
  contact: "agent@example.com"
});

const [myProfile] = PublicKey.findProgramAddressSync(
  [Buffer.from("agent"), wallet.publicKey.toBuffer()],
  program.programId
);

await program.methods
  .registerAgent(metadataUri)
  .accounts({
    agentProfile: myProfile,
    authority: wallet.publicKey,
    systemProgram: SystemProgram.programId,
  })
  .rpc();

console.log("Registered!");

// 2. Check another agent
const targetAgent = new PublicKey("TARGET_PUBKEY");
const [targetProfile] = PublicKey.findProgramAddressSync(
  [Buffer.from("agent"), targetAgent.toBuffer()],
  program.programId
);

const profile = await program.account.agentProfile.fetch(targetProfile);
console.log(`Reputation: ${profile.reputationScore}`);
console.log(`Vouches: ${profile.vouchesReceived}`);
console.log(`Disputes lost: ${profile.disputesLost}`);

// 3. Vouch if trusted
if (profile.disputesLost.toNumber() === 0 && profile.reputationScore.toNumber() > 0) {
  const [vouchPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("vouch"), wallet.publicKey.toBuffer(), targetAgent.toBuffer()],
    program.programId
  );
  
  await program.methods
    .vouch(new anchor.BN(0.05 * anchor.web3.LAMPORTS_PER_SOL))
    .accounts({
      vouch: vouchPda,
      voucher: wallet.publicKey,
      voucherProfile: myProfile,
      vouchee: targetAgent,
      voucheeProfile: targetProfile,
      systemProgram: SystemProgram.programId,
    })
    .rpc();
  
  console.log("Vouched with 0.05 SOL!");
}
```

## Composability

This reputation oracle is designed to integrate with:
- **Eliza plugins**: Check reputation before installing skills
- **AgentWallet**: Use reputation for transaction approvals
- **OpenClaw**: Query reputation in agent decision-making
- **DAO voting**: Weight votes by reputation
- **Marketplaces**: Display trust badges

**Future integrations:**
- Cross-chain bridges (Wormhole)
- Multi-agent juries for dispute resolution
- Automated slashing based on on-chain behavior
- Reputation-gated features (min score to access certain tools)

## Support

- **Web UI**: https://agentvouch.vercel.app/
- **GitHub**: https://github.com/dirtybits/agent-reputation-oracle
- **Issues**: https://github.com/dirtybits/agent-reputation-oracle/issues
- **Twitter**: [@dirtybits](https://twitter.com/dirtybits)

## License

MIT - Built during Colosseum Agent Hackathon 2026
