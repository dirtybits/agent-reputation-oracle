import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { ReputationOracle } from "../target/types/reputation_oracle";
import { PublicKey, Keypair, SystemProgram } from "@solana/web3.js";
import { assert } from "chai";

describe("reputation-oracle", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace
    .ReputationOracle as Program<ReputationOracle>;

  // Config PDA
  const [configPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    program.programId
  );

  // Test keypairs
  let agent1: Keypair;
  let agent2: Keypair;
  let agent3: Keypair;

  function getAgentPda(authority: PublicKey): PublicKey {
    const [agentPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("agent"), authority.toBuffer()],
      program.programId
    );
    return agentPda;
  }

  function getAuthorBondPda(authority: PublicKey): PublicKey {
    const [authorBondPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("author_bond"), authority.toBuffer()],
      program.programId
    );
    return authorBondPda;
  }

  before(async () => {
    agent1 = Keypair.generate();
    agent2 = Keypair.generate();
    agent3 = Keypair.generate();

    // Airdrop SOL to test agents
    await provider.connection.requestAirdrop(
      agent1.publicKey,
      10 * anchor.web3.LAMPORTS_PER_SOL
    );
    await provider.connection.requestAirdrop(
      agent2.publicKey,
      10 * anchor.web3.LAMPORTS_PER_SOL
    );
    await provider.connection.requestAirdrop(
      agent3.publicKey,
      10 * anchor.web3.LAMPORTS_PER_SOL
    );

    // Wait for confirmations
    await new Promise((resolve) => setTimeout(resolve, 2000));
  });

  it("Initializes the config", async () => {
    const minStake = new anchor.BN(0.01 * anchor.web3.LAMPORTS_PER_SOL);
    const disputeBond = new anchor.BN(0.1 * anchor.web3.LAMPORTS_PER_SOL);
    const minAuthorBondForFreeListing = disputeBond;
    const slashPercentage = 50;
    const cooldownPeriod = new anchor.BN(86400); // 1 day

    try {
      const tx = await program.methods
        .initializeConfig(
          minStake,
          disputeBond,
          minAuthorBondForFreeListing,
          slashPercentage,
          cooldownPeriod
        )
        .accounts({
          config: configPda,
          authority: provider.wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      console.log("Initialize config tx:", tx);
    } catch {
      console.log("Config already initialized (shared validator state)");
    }

    const config = await program.account.reputationConfig.fetch(configPda);
    assert.equal(config.minStake.toString(), minStake.toString());
    assert.equal(config.disputeBond.toString(), disputeBond.toString());
    assert.equal(
      config.minAuthorBondForFreeListing.toString(),
      minAuthorBondForFreeListing.toString()
    );
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
    const agentPda = getAgentPda(agent2.publicKey);

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

  it("Registers agent 3", async () => {
    const agentPda = getAgentPda(agent3.publicKey);

    const tx = await program.methods
      .registerAgent("https://example.com/agent3.json")
      .accounts({
        agentProfile: agentPda,
        authority: agent3.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([agent3])
      .rpc();

    console.log("Register agent3 tx:", tx);
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

    console.log(
      "Agent 2 reputation score:",
      agent2Profile.reputationScore.toString()
    );
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

    const beforeBalance = await provider.connection.getBalance(
      agent1.publicKey
    );

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

  it("Agent 1 re-vouches for Agent 2 using the same PDA", async () => {
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

    console.log("Re-vouch tx:", tx);

    const vouch = await program.account.vouch.fetch(vouchPda);
    assert.equal(vouch.status.active !== undefined, true);
    assert.equal(vouch.stakeAmount.toString(), stakeAmount.toString());

    const agent1Profile = await program.account.agentProfile.fetch(agent1Pda);
    const agent2Profile = await program.account.agentProfile.fetch(agent2Pda);
    assert.equal(agent1Profile.totalVouchesGiven, 1);
    assert.equal(agent2Profile.totalVouchesReceived, 1);
    assert.equal(
      agent2Profile.totalStakedFor.toString(),
      stakeAmount.toString()
    );
  });

  it("Agent 1 tops up the existing vouch for Agent 2", async () => {
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

    const vouchBefore = await program.account.vouch.fetch(vouchPda);
    const agent2Before = await program.account.agentProfile.fetch(agent2Pda);
    const additionalStake = new anchor.BN(0.02 * anchor.web3.LAMPORTS_PER_SOL);

    const tx = await program.methods
      .vouch(additionalStake)
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

    console.log("Top-up vouch tx:", tx);

    const vouchAfter = await program.account.vouch.fetch(vouchPda);
    const agent1Profile = await program.account.agentProfile.fetch(agent1Pda);
    const agent2After = await program.account.agentProfile.fetch(agent2Pda);
    const expectedStake = vouchBefore.stakeAmount.add(additionalStake);
    const expectedTotalStaked =
      agent2Before.totalStakedFor.add(additionalStake);

    assert.equal(vouchAfter.status.active !== undefined, true);
    assert.equal(vouchAfter.stakeAmount.toString(), expectedStake.toString());
    assert.equal(agent1Profile.totalVouchesGiven, 1);
    assert.equal(agent2After.totalVouchesReceived, 1);
    assert.equal(
      agent2After.totalStakedFor.toString(),
      expectedTotalStaked.toString()
    );
  });

  it("Agent 3 deposits and withdraws author bond", async () => {
    const agent3Pda = getAgentPda(agent3.publicKey);
    const authorBondPda = getAuthorBondPda(agent3.publicKey);
    const depositAmount = new anchor.BN(0.2 * anchor.web3.LAMPORTS_PER_SOL);
    const withdrawAmount = new anchor.BN(0.05 * anchor.web3.LAMPORTS_PER_SOL);

    await program.methods
      .depositAuthorBond(depositAmount)
      .accounts({
        authorBond: authorBondPda,
        authorProfile: agent3Pda,
        config: configPda,
        author: agent3.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([agent3])
      .rpc();

    const authorBondAfterDeposit = await program.account.authorBond.fetch(
      authorBondPda
    );
    const agent3AfterDeposit = await program.account.agentProfile.fetch(
      agent3Pda
    );
    assert.equal(
      authorBondAfterDeposit.amount.toString(),
      depositAmount.toString()
    );
    assert.equal(
      agent3AfterDeposit.authorBondLamports.toString(),
      depositAmount.toString()
    );
    assert.isTrue(agent3AfterDeposit.reputationScore.toNumber() > 0);

    await program.methods
      .withdrawAuthorBond(withdrawAmount)
      .accounts({
        authorBond: authorBondPda,
        authorProfile: agent3Pda,
        config: configPda,
        author: agent3.publicKey,
      })
      .signers([agent3])
      .rpc();

    const authorBondAfterWithdraw = await program.account.authorBond.fetch(
      authorBondPda
    );
    const agent3AfterWithdraw = await program.account.agentProfile.fetch(
      agent3Pda
    );
    const expectedRemaining = depositAmount.sub(withdrawAmount);

    assert.equal(
      authorBondAfterWithdraw.amount.toString(),
      expectedRemaining.toString()
    );
    assert.equal(
      agent3AfterWithdraw.authorBondLamports.toString(),
      expectedRemaining.toString()
    );
  });

  it("Preserves bond state when the author re-migrates a current profile", async () => {
    const agent3Pda = getAgentPda(agent3.publicKey);
    const before = await program.account.agentProfile.fetch(agent3Pda);

    await program.methods
      .migrateAgent(before.metadataUri)
      .accounts({
        agentProfile: agent3Pda,
        authority: agent3.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([agent3])
      .rpc();

    const after = await program.account.agentProfile.fetch(agent3Pda);
    assert.equal(after.authority.toString(), before.authority.toString());
    assert.equal(after.metadataUri, before.metadataUri);
    assert.equal(
      after.authorBondLamports.toString(),
      before.authorBondLamports.toString()
    );
    assert.equal(after.activeFreeSkillListings, before.activeFreeSkillListings);
    assert.equal(after.openAuthorDisputes, before.openAuthorDisputes);
    assert.equal(after.bump, before.bump);
  });

  it("Lets the config authority admin-migrate a current profile without the owner signer", async () => {
    const agent3Pda = getAgentPda(agent3.publicKey);
    const before = await program.account.agentProfile.fetch(agent3Pda);

    await program.methods
      .adminMigrateAgent()
      .accounts({
        agentProfile: agent3Pda,
        config: configPda,
        authority: provider.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const after = await program.account.agentProfile.fetch(agent3Pda);
    assert.equal(after.authority.toString(), before.authority.toString());
    assert.equal(after.metadataUri, before.metadataUri);
    assert.equal(
      after.authorBondLamports.toString(),
      before.authorBondLamports.toString()
    );
    assert.equal(after.activeFreeSkillListings, before.activeFreeSkillListings);
    assert.equal(after.openAuthorDisputes, before.openAuthorDisputes);
  });
});
