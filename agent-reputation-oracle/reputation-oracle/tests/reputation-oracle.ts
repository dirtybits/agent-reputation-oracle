import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { ReputationOracle } from "../target/types/reputation_oracle";
import { PublicKey, Keypair, SystemProgram } from "@solana/web3.js";
import { assert } from "chai";

describe("reputation-oracle", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.ReputationOracle as Program<ReputationOracle>;
  
  // Config PDA
  const [configPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    program.programId
  );
  
  // Test keypairs
  let agent1: Keypair;
  let agent2: Keypair;
  let agent3: Keypair;
  
  before(async () => {
    agent1 = Keypair.generate();
    agent2 = Keypair.generate();
    agent3 = Keypair.generate();
    
    // Airdrop SOL to test agents
    await provider.connection.requestAirdrop(agent1.publicKey, 10 * anchor.web3.LAMPORTS_PER_SOL);
    await provider.connection.requestAirdrop(agent2.publicKey, 10 * anchor.web3.LAMPORTS_PER_SOL);
    await provider.connection.requestAirdrop(agent3.publicKey, 10 * anchor.web3.LAMPORTS_PER_SOL);
    
    // Wait for confirmations
    await new Promise(resolve => setTimeout(resolve, 2000));
  });

  it("Initializes the config", async () => {
    const minStake = new anchor.BN(0.01 * anchor.web3.LAMPORTS_PER_SOL);
    const disputeBond = new anchor.BN(0.1 * anchor.web3.LAMPORTS_PER_SOL);
    const slashPercentage = 50;
    const cooldownPeriod = new anchor.BN(86400); // 1 day
    
    const tx = await program.methods
      .initializeConfig(minStake, disputeBond, slashPercentage, cooldownPeriod)
      .accounts({
        config: configPda,
        authority: provider.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    
    console.log("Initialize config tx:", tx);
    
    const config = await program.account.reputationConfig.fetch(configPda);
    assert.equal(config.minStake.toString(), minStake.toString());
    assert.equal(config.disputeBond.toString(), disputeBond.toString());
    assert.equal(config.slashPercentage, slashPercentage);
    assert.equal(config.stakeWeight, 1);
    assert.equal(config.vouchWeight, 100);
  });

  it("Registers agent 1", async () => {
    const [agentPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("agent"), agent1.publicKey.toBuffer()],
      program.programId
    );
    
    const metadataUri = "https://example.com/agent1.json";
    
    const tx = await program.methods
      .registerAgent(metadataUri)
      .accounts({
        agentProfile: agentPda,
        authority: agent1.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([agent1])
      .rpc();
    
    console.log("Register agent1 tx:", tx);
    
    const profile = await program.account.agentProfile.fetch(agentPda);
    assert.equal(profile.authority.toString(), agent1.publicKey.toString());
    assert.equal(profile.metadataUri, metadataUri);
    assert.equal(profile.totalVouchesReceived, 0);
    assert.equal(profile.reputationScore.toNumber(), 0);
  });

  it("Registers agent 2", async () => {
    const [agentPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("agent"), agent2.publicKey.toBuffer()],
      program.programId
    );
    
    const tx = await program.methods
      .registerAgent("https://example.com/agent2.json")
      .accounts({
        agentProfile: agentPda,
        authority: agent2.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([agent2])
      .rpc();
    
    console.log("Register agent2 tx:", tx);
  });

  it("Agent 1 vouches for Agent 2", async () => {
    const [agent1Pda] = PublicKey.findProgramAddressSync(
      [Buffer.from("agent"), agent1.publicKey.toBuffer()],
      program.programId
    );
    
    const [agent2Pda] = PublicKey.findProgramAddressSync(
      [Buffer.from("agent"), agent2.publicKey.toBuffer()],
      program.programId
    );
    
    const [vouchPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("vouch"), agent1Pda.toBuffer(), agent2Pda.toBuffer()],
      program.programId
    );
    
    const stakeAmount = new anchor.BN(0.05 * anchor.web3.LAMPORTS_PER_SOL);
    
    const tx = await program.methods
      .vouch(stakeAmount)
      .accounts({
        vouch: vouchPda,
        voucherProfile: agent1Pda,
        voucheeProfile: agent2Pda,
        config: configPda,
        voucher: agent1.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([agent1])
      .rpc();
    
    console.log("Vouch tx:", tx);
    
    const vouch = await program.account.vouch.fetch(vouchPda);
    assert.equal(vouch.voucher.toString(), agent1Pda.toString());
    assert.equal(vouch.vouchee.toString(), agent2Pda.toString());
    assert.equal(vouch.stakeAmount.toString(), stakeAmount.toString());
    
    // Check reputation updated
    const agent2Profile = await program.account.agentProfile.fetch(agent2Pda);
    assert.equal(agent2Profile.totalVouchesReceived, 1);
    assert.isTrue(agent2Profile.reputationScore.toNumber() > 0);
    
    console.log("Agent 2 reputation score:", agent2Profile.reputationScore.toString());
  });

  it("Agent 1 revokes vouch for Agent 2", async () => {
    const [agent1Pda] = PublicKey.findProgramAddressSync(
      [Buffer.from("agent"), agent1.publicKey.toBuffer()],
      program.programId
    );
    
    const [agent2Pda] = PublicKey.findProgramAddressSync(
      [Buffer.from("agent"), agent2.publicKey.toBuffer()],
      program.programId
    );
    
    const [vouchPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("vouch"), agent1Pda.toBuffer(), agent2Pda.toBuffer()],
      program.programId
    );
    
    const beforeBalance = await provider.connection.getBalance(agent1.publicKey);
    
    const tx = await program.methods
      .revokeVouch()
      .accounts({
        vouch: vouchPda,
        voucherProfile: agent1Pda,
        voucheeProfile: agent2Pda,
        config: configPda,
        voucher: agent1.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([agent1])
      .rpc();
    
    console.log("Revoke vouch tx:", tx);
    
    const vouch = await program.account.vouch.fetch(vouchPda);
    assert.equal(vouch.status.revoked !== undefined, true);
    
    // Check reputation updated
    const agent2Profile = await program.account.agentProfile.fetch(agent2Pda);
    assert.equal(agent2Profile.totalVouchesReceived, 0);
    assert.equal(agent2Profile.reputationScore.toNumber(), 0);
    
    // Check stake was returned (approximately - minus tx fees)
    const afterBalance = await provider.connection.getBalance(agent1.publicKey);
    assert.isTrue(afterBalance > beforeBalance);
  });

  it("Agent 1 vouches for Agent 2 again (for dispute test)", async () => {
    const [agent1Pda] = PublicKey.findProgramAddressSync(
      [Buffer.from("agent"), agent1.publicKey.toBuffer()],
      program.programId
    );
    
    const [agent2Pda] = PublicKey.findProgramAddressSync(
      [Buffer.from("agent"), agent2.publicKey.toBuffer()],
      program.programId
    );
    
    // Need to close old vouch account first or use different seed
    // For now, let's create a new test with agent3
    const [agent3Pda] = PublicKey.findProgramAddressSync(
      [Buffer.from("agent"), agent3.publicKey.toBuffer()],
      program.programId
    );
    
    // Register agent3
    await program.methods
      .registerAgent("https://example.com/agent3.json")
      .accounts({
        agentProfile: agent3Pda,
        authority: agent3.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([agent3])
      .rpc();
    
    const [vouchPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("vouch"), agent1Pda.toBuffer(), agent3Pda.toBuffer()],
      program.programId
    );
    
    const stakeAmount = new anchor.BN(0.05 * anchor.web3.LAMPORTS_PER_SOL);
    
    await program.methods
      .vouch(stakeAmount)
      .accounts({
        vouch: vouchPda,
        voucherProfile: agent1Pda,
        voucheeProfile: agent3Pda,
        config: configPda,
        voucher: agent1.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([agent1])
      .rpc();
    
    console.log("Agent 1 vouched for Agent 3");
  });

  it("Opens a dispute on a vouch", async () => {
    const [agent1Pda] = PublicKey.findProgramAddressSync(
      [Buffer.from("agent"), agent1.publicKey.toBuffer()],
      program.programId
    );
    
    const [agent3Pda] = PublicKey.findProgramAddressSync(
      [Buffer.from("agent"), agent3.publicKey.toBuffer()],
      program.programId
    );
    
    const [vouchPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("vouch"), agent1Pda.toBuffer(), agent3Pda.toBuffer()],
      program.programId
    );
    
    const [disputePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("dispute"), vouchPda.toBuffer()],
      program.programId
    );
    
    const tx = await program.methods
      .openDispute("https://example.com/evidence.json")
      .accounts({
        dispute: disputePda,
        vouch: vouchPda,
        config: configPda,
        challenger: agent2.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([agent2])
      .rpc();
    
    console.log("Open dispute tx:", tx);
    
    const dispute = await program.account.dispute.fetch(disputePda);
    assert.equal(dispute.vouch.toString(), vouchPda.toString());
    assert.equal(dispute.challenger.toString(), agent2.publicKey.toString());
    assert.equal(dispute.status.open !== undefined, true);
    
    const vouch = await program.account.vouch.fetch(vouchPda);
    assert.equal(vouch.status.disputed !== undefined, true);
  });

  it("Resolves a dispute (slash voucher)", async () => {
    const [agent1Pda] = PublicKey.findProgramAddressSync(
      [Buffer.from("agent"), agent1.publicKey.toBuffer()],
      program.programId
    );
    
    const [agent3Pda] = PublicKey.findProgramAddressSync(
      [Buffer.from("agent"), agent3.publicKey.toBuffer()],
      program.programId
    );
    
    const [vouchPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("vouch"), agent1Pda.toBuffer(), agent3Pda.toBuffer()],
      program.programId
    );
    
    const [disputePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("dispute"), vouchPda.toBuffer()],
      program.programId
    );
    
    const tx = await program.methods
      .resolveDispute({ slashVoucher: {} })
      .accounts({
        dispute: disputePda,
        vouch: vouchPda,
        voucherProfile: agent1Pda,
        voucheeProfile: agent3Pda,
        config: configPda,
        authority: provider.wallet.publicKey,
        challenger: agent2.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    
    console.log("Resolve dispute tx:", tx);
    
    const dispute = await program.account.dispute.fetch(disputePda);
    assert.equal(dispute.status.resolved !== undefined, true);
    assert.equal(dispute.ruling.slashVoucher !== undefined, true);
    
    const vouch = await program.account.vouch.fetch(vouchPda);
    assert.equal(vouch.status.slashed !== undefined, true);
    
    // Check voucher profile updated
    const agent1Profile = await program.account.agentProfile.fetch(agent1Pda);
    assert.equal(agent1Profile.disputesLost, 1);
  });
});
