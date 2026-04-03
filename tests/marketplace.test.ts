import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { ReputationOracle } from "../target/types/reputation_oracle";
import { PublicKey, Keypair, SystemProgram } from "@solana/web3.js";
import { assert } from "chai";

describe("marketplace", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace
    .ReputationOracle as Program<ReputationOracle>;

  const [configPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    program.programId
  );

  let author: Keypair;
  let voucher: Keypair;
  let buyer: Keypair;

  before(async () => {
    author = Keypair.generate();
    voucher = Keypair.generate();
    buyer = Keypair.generate();

    // Airdrop SOL
    await provider.connection.requestAirdrop(
      author.publicKey,
      10 * anchor.web3.LAMPORTS_PER_SOL
    );
    await provider.connection.requestAirdrop(
      voucher.publicKey,
      10 * anchor.web3.LAMPORTS_PER_SOL
    );
    await provider.connection.requestAirdrop(
      buyer.publicKey,
      10 * anchor.web3.LAMPORTS_PER_SOL
    );

    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Initialize config (needed for vouching)
    try {
      await program.methods
        .initializeConfig(
          new anchor.BN(0.01 * anchor.web3.LAMPORTS_PER_SOL),
          new anchor.BN(0.1 * anchor.web3.LAMPORTS_PER_SOL),
          50,
          new anchor.BN(86400)
        )
        .accounts({
          config: configPda,
          authority: provider.wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
    } catch {
      // Config may already exist from other test suite
    }

    // Register agents
    const [authorProfile] = PublicKey.findProgramAddressSync(
      [Buffer.from("agent"), author.publicKey.toBuffer()],
      program.programId
    );

    const [voucherProfile] = PublicKey.findProgramAddressSync(
      [Buffer.from("agent"), voucher.publicKey.toBuffer()],
      program.programId
    );

    const [buyerProfile] = PublicKey.findProgramAddressSync(
      [Buffer.from("agent"), buyer.publicKey.toBuffer()],
      program.programId
    );

    await program.methods
      .registerAgent("https://author.agent")
      .accounts({
        agentProfile: authorProfile,
        authority: author.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([author])
      .rpc();

    await program.methods
      .registerAgent("https://voucher.agent")
      .accounts({
        agentProfile: voucherProfile,
        authority: voucher.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([voucher])
      .rpc();

    await program.methods
      .registerAgent("https://buyer.agent")
      .accounts({
        agentProfile: buyerProfile,
        authority: buyer.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([buyer])
      .rpc();

    console.log("Test agents registered");
  });

  it("Creates a skill listing", async () => {
    const skillId = "test-skill-" + Date.now();
    const [skillListing] = PublicKey.findProgramAddressSync(
      [Buffer.from("skill"), author.publicKey.toBuffer(), Buffer.from(skillId)],
      program.programId
    );

    const [authorProfile] = PublicKey.findProgramAddressSync(
      [Buffer.from("agent"), author.publicKey.toBuffer()],
      program.programId
    );

    const skillUri = "ipfs://QmTest123";
    const name = "Test Trading Skill";
    const description = "AI trading bot for Solana DEXes";
    const priceLamports = new anchor.BN(0.5 * anchor.web3.LAMPORTS_PER_SOL);

    await program.methods
      .createSkillListing(skillId, skillUri, name, description, priceLamports)
      .accounts({
        skillListing,
        authorProfile,
        author: author.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([author])
      .rpc();

    const listing = await program.account.skillListing.fetch(skillListing);
    assert.equal(listing.author.toBase58(), author.publicKey.toBase58());
    assert.equal(listing.name, name);
    assert.equal(listing.priceLamports.toNumber(), priceLamports.toNumber());
    assert.equal(listing.totalDownloads, 0);
    assert.equal(listing.totalRevenue.toNumber(), 0);
    assert.equal(listing.unclaimedVoucherRevenue.toNumber(), 0);
  });

  it("Purchases skill and verifies 60/40 revenue split with 40% deposited to skill listing", async () => {
    const skillId = "revenue-test-" + Date.now();
    const price = new anchor.BN(1 * anchor.web3.LAMPORTS_PER_SOL);

    const [skillListing] = PublicKey.findProgramAddressSync(
      [Buffer.from("skill"), author.publicKey.toBuffer(), Buffer.from(skillId)],
      program.programId
    );

    const [authorProfile] = PublicKey.findProgramAddressSync(
      [Buffer.from("agent"), author.publicKey.toBuffer()],
      program.programId
    );

    await program.methods
      .createSkillListing(
        skillId,
        "ipfs://QmRevTest",
        "Revenue Test Skill",
        "Test 60/40 split",
        price
      )
      .accounts({
        skillListing,
        authorProfile,
        author: author.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([author])
      .rpc();

    const authorBalanceBefore = await provider.connection.getBalance(
      author.publicKey
    );
    const skillBalanceBefore = await provider.connection.getBalance(
      skillListing
    );

    const [purchase] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("purchase"),
        buyer.publicKey.toBuffer(),
        skillListing.toBuffer(),
      ],
      program.programId
    );

    await program.methods
      .purchaseSkill()
      .accounts({
        skillListing,
        purchase,
        author: author.publicKey,
        authorProfile,
        buyer: buyer.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([buyer])
      .rpc();

    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Verify purchase record
    const purchaseRecord = await program.account.purchase.fetch(purchase);
    assert.equal(purchaseRecord.buyer.toBase58(), buyer.publicKey.toBase58());
    assert.equal(purchaseRecord.pricePaid.toNumber(), price.toNumber());

    // Verify skill listing stats
    const listing = await program.account.skillListing.fetch(skillListing);
    assert.equal(listing.totalDownloads, 1);
    assert.equal(listing.totalRevenue.toNumber(), price.toNumber());

    // Verify unclaimed_voucher_revenue tracks the 40%
    const expected40Percent = price.toNumber() * 0.4;
    assert.equal(listing.unclaimedVoucherRevenue.toNumber(), expected40Percent);

    // Verify author received 60%
    const authorBalanceAfter = await provider.connection.getBalance(
      author.publicKey
    );
    const authorReceived = authorBalanceAfter - authorBalanceBefore;
    const expected60Percent = price.toNumber() * 0.6;
    assert.approximately(
      authorReceived,
      expected60Percent,
      0.01 * anchor.web3.LAMPORTS_PER_SOL,
      "Author should receive ~60% of payment"
    );

    // Verify 40% lamports landed in skill listing account
    const skillBalanceAfter = await provider.connection.getBalance(
      skillListing
    );
    const skillReceived = skillBalanceAfter - skillBalanceBefore;
    assert.approximately(
      skillReceived,
      expected40Percent,
      0.001 * anchor.web3.LAMPORTS_PER_SOL,
      "Skill listing should receive ~40% of payment"
    );

    console.log("Revenue split verified:");
    console.log(
      "  Author received:",
      authorReceived / anchor.web3.LAMPORTS_PER_SOL,
      "SOL (60%)"
    );
    console.log(
      "  Skill listing received:",
      skillReceived / anchor.web3.LAMPORTS_PER_SOL,
      "SOL (40%)"
    );
    console.log(
      "  unclaimed_voucher_revenue:",
      listing.unclaimedVoucherRevenue.toNumber() / anchor.web3.LAMPORTS_PER_SOL,
      "SOL"
    );
  });

  it("Voucher claims revenue after purchase (end-to-end)", async () => {
    const skillId = "claim-test-" + Date.now();
    const price = new anchor.BN(1 * anchor.web3.LAMPORTS_PER_SOL);
    const stakeAmount = new anchor.BN(0.05 * anchor.web3.LAMPORTS_PER_SOL);

    const [authorProfile] = PublicKey.findProgramAddressSync(
      [Buffer.from("agent"), author.publicKey.toBuffer()],
      program.programId
    );

    const [voucherProfile] = PublicKey.findProgramAddressSync(
      [Buffer.from("agent"), voucher.publicKey.toBuffer()],
      program.programId
    );

    // Step 1: Voucher vouches for author
    const [vouchPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("vouch"),
        voucherProfile.toBuffer(),
        authorProfile.toBuffer(),
      ],
      program.programId
    );

    await program.methods
      .vouch(stakeAmount)
      .accounts({
        vouch: vouchPda,
        voucherProfile,
        voucheeProfile: authorProfile,
        config: configPda,
        voucher: voucher.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([voucher])
      .rpc();

    const vouchData = await program.account.vouch.fetch(vouchPda);
    assert.equal(vouchData.stakeAmount.toNumber(), stakeAmount.toNumber());
    assert.equal(vouchData.cumulativeRevenue.toNumber(), 0);
    console.log(
      "Vouch created for author with stake:",
      stakeAmount.toNumber() / anchor.web3.LAMPORTS_PER_SOL,
      "SOL"
    );

    // Step 2: Create skill listing
    const [skillListing] = PublicKey.findProgramAddressSync(
      [Buffer.from("skill"), author.publicKey.toBuffer(), Buffer.from(skillId)],
      program.programId
    );

    await program.methods
      .createSkillListing(
        skillId,
        "ipfs://QmClaimTest",
        "Claim Test Skill",
        "Test claim flow",
        price
      )
      .accounts({
        skillListing,
        authorProfile,
        author: author.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([author])
      .rpc();

    // Step 3: Buyer purchases skill
    const [purchase] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("purchase"),
        buyer.publicKey.toBuffer(),
        skillListing.toBuffer(),
      ],
      program.programId
    );

    await program.methods
      .purchaseSkill()
      .accounts({
        skillListing,
        purchase,
        author: author.publicKey,
        authorProfile,
        buyer: buyer.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([buyer])
      .rpc();

    // Verify 40% is in the skill listing
    const listingAfterPurchase = await program.account.skillListing.fetch(
      skillListing
    );
    const expected40Percent = price.toNumber() * 0.4;
    assert.equal(
      listingAfterPurchase.unclaimedVoucherRevenue.toNumber(),
      expected40Percent
    );
    console.log(
      "Skill purchased, voucher pool:",
      expected40Percent / anchor.web3.LAMPORTS_PER_SOL,
      "SOL"
    );

    // Step 4: Voucher claims revenue
    const voucherBalanceBefore = await provider.connection.getBalance(
      voucher.publicKey
    );

    await program.methods
      .claimVoucherRevenue()
      .accounts({
        skillListing,
        vouch: vouchPda,
        voucherProfile,
        authorProfile,
        voucher: voucher.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([voucher])
      .rpc();

    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Verify voucher received the full 40% (only voucher, so 100% of pool)
    const voucherBalanceAfter = await provider.connection.getBalance(
      voucher.publicKey
    );
    const voucherReceived = voucherBalanceAfter - voucherBalanceBefore;

    // The voucher is the only staker, so they get the full 40% minus tx fee
    assert.approximately(
      voucherReceived,
      expected40Percent,
      0.01 * anchor.web3.LAMPORTS_PER_SOL,
      "Voucher should receive ~40% of purchase price"
    );

    // Verify vouch cumulative_revenue updated
    const vouchAfterClaim = await program.account.vouch.fetch(vouchPda);
    assert.equal(
      vouchAfterClaim.cumulativeRevenue.toNumber(),
      expected40Percent
    );

    // Verify unclaimed_voucher_revenue is now 0
    const listingAfterClaim = await program.account.skillListing.fetch(
      skillListing
    );
    assert.equal(listingAfterClaim.unclaimedVoucherRevenue.toNumber(), 0);

    console.log("Revenue claimed successfully:");
    console.log(
      "  Voucher received:",
      voucherReceived / anchor.web3.LAMPORTS_PER_SOL,
      "SOL"
    );
    console.log(
      "  cumulative_revenue:",
      vouchAfterClaim.cumulativeRevenue.toNumber() /
        anchor.web3.LAMPORTS_PER_SOL,
      "SOL"
    );
    console.log(
      "  unclaimed remaining:",
      listingAfterClaim.unclaimedVoucherRevenue.toNumber(),
      "lamports"
    );
  });

  it("Claim fails for revoked vouch", async () => {
    const skillId = "revoke-claim-test-" + Date.now();
    const price = new anchor.BN(1 * anchor.web3.LAMPORTS_PER_SOL);
    const stakeAmount = new anchor.BN(0.05 * anchor.web3.LAMPORTS_PER_SOL);

    // Use a fresh voucher so we don't collide with the existing vouch PDA
    const voucher2 = Keypair.generate();
    await provider.connection.requestAirdrop(
      voucher2.publicKey,
      10 * anchor.web3.LAMPORTS_PER_SOL
    );
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const [voucher2Profile] = PublicKey.findProgramAddressSync(
      [Buffer.from("agent"), voucher2.publicKey.toBuffer()],
      program.programId
    );
    const [authorProfile] = PublicKey.findProgramAddressSync(
      [Buffer.from("agent"), author.publicKey.toBuffer()],
      program.programId
    );

    await program.methods
      .registerAgent("https://voucher2.agent")
      .accounts({
        agentProfile: voucher2Profile,
        authority: voucher2.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([voucher2])
      .rpc();

    // Vouch
    const [vouchPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("vouch"),
        voucher2Profile.toBuffer(),
        authorProfile.toBuffer(),
      ],
      program.programId
    );

    await program.methods
      .vouch(stakeAmount)
      .accounts({
        vouch: vouchPda,
        voucherProfile: voucher2Profile,
        voucheeProfile: authorProfile,
        config: configPda,
        voucher: voucher2.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([voucher2])
      .rpc();

    // Revoke the vouch
    await program.methods
      .revokeVouch()
      .accounts({
        vouch: vouchPda,
        voucherProfile: voucher2Profile,
        voucheeProfile: authorProfile,
        config: configPda,
        voucher: voucher2.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([voucher2])
      .rpc();

    // Create skill and purchase it
    const [skillListing] = PublicKey.findProgramAddressSync(
      [Buffer.from("skill"), author.publicKey.toBuffer(), Buffer.from(skillId)],
      program.programId
    );

    await program.methods
      .createSkillListing(skillId, "ipfs://Qm", "Revoke Test", "test", price)
      .accounts({
        skillListing,
        authorProfile,
        author: author.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([author])
      .rpc();

    const buyer2 = Keypair.generate();
    await provider.connection.requestAirdrop(
      buyer2.publicKey,
      10 * anchor.web3.LAMPORTS_PER_SOL
    );
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const [buyer2Profile] = PublicKey.findProgramAddressSync(
      [Buffer.from("agent"), buyer2.publicKey.toBuffer()],
      program.programId
    );
    await program.methods
      .registerAgent("https://buyer2.agent")
      .accounts({
        agentProfile: buyer2Profile,
        authority: buyer2.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([buyer2])
      .rpc();

    const [purchase] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("purchase"),
        buyer2.publicKey.toBuffer(),
        skillListing.toBuffer(),
      ],
      program.programId
    );

    await program.methods
      .purchaseSkill()
      .accounts({
        skillListing,
        purchase,
        author: author.publicKey,
        authorProfile,
        buyer: buyer2.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([buyer2])
      .rpc();

    // Attempt claim with revoked vouch — should fail
    try {
      await program.methods
        .claimVoucherRevenue()
        .accounts({
          skillListing,
          vouch: vouchPda,
          voucherProfile: voucher2Profile,
          authorProfile,
          voucher: voucher2.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([voucher2])
        .rpc();
      assert.fail("Should have thrown error for revoked vouch");
    } catch (err: any) {
      assert.include(err.toString(), "VouchNotEligible");
      console.log("Correctly rejected claim for revoked vouch");
    }
  });
});
