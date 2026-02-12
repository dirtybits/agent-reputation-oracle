import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { ReputationOracle } from "../target/types/reputation_oracle";
import { PublicKey, Keypair, SystemProgram } from "@solana/web3.js";
import { assert } from "chai";

describe("marketplace", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.ReputationOracle as Program<ReputationOracle>;
  
  let author: Keypair;
  let voucher: Keypair;
  let buyer: Keypair;
  
  before(async () => {
    author = Keypair.generate();
    voucher = Keypair.generate();
    buyer = Keypair.generate();
    
    // Airdrop SOL
    await provider.connection.requestAirdrop(author.publicKey, 10 * anchor.web3.LAMPORTS_PER_SOL);
    await provider.connection.requestAirdrop(voucher.publicKey, 10 * anchor.web3.LAMPORTS_PER_SOL);
    await provider.connection.requestAirdrop(buyer.publicKey, 10 * anchor.web3.LAMPORTS_PER_SOL);
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
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
    
    console.log("✅ Test agents registered");
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
    
    const tx = await program.methods
      .createSkillListing(skillId, skillUri, name, description, priceLamports)
      .accounts({
        skillListing,
        authorProfile,
        author: author.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([author])
      .rpc();
    
    console.log("Create skill listing tx:", tx);
    
    const listing = await program.account.skillListing.fetch(skillListing);
    assert.equal(listing.author.toBase58(), author.publicKey.toBase58());
    assert.equal(listing.name, name);
    assert.equal(listing.priceLamports.toNumber(), priceLamports.toNumber());
    assert.equal(listing.totalDownloads, 0);
    assert.equal(listing.totalRevenue.toNumber(), 0);
    
    console.log("✅ Skill listing created successfully");
  });

  it("Purchases skill and verifies 60/40 revenue split", async () => {
    const skillId = "revenue-test-" + Date.now();
    const price = new anchor.BN(1 * anchor.web3.LAMPORTS_PER_SOL); // 1 SOL for easy math
    
    // Setup: Create skill listing
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
    
    console.log("✅ Test skill created");
    
    // Get balances before purchase
    const authorBalanceBefore = await provider.connection.getBalance(author.publicKey);
    
    // Create purchase
    const [purchase] = PublicKey.findProgramAddressSync(
      [Buffer.from("purchase"), buyer.publicKey.toBuffer(), skillListing.toBuffer()],
      program.programId
    );
    
    const tx = await program.methods
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
    
    console.log("Purchase tx:", tx);
    
    // Wait for confirmation
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Verify purchase record
    const purchaseRecord = await program.account.purchase.fetch(purchase);
    assert.equal(purchaseRecord.buyer.toBase58(), buyer.publicKey.toBase58());
    assert.equal(purchaseRecord.pricePaid.toNumber(), price.toNumber());
    
    // Verify skill listing updated
    const listing = await program.account.skillListing.fetch(skillListing);
    assert.equal(listing.totalDownloads, 1);
    assert.equal(listing.totalRevenue.toNumber(), price.toNumber());
    
    // Verify author received 60% (0.6 SOL)
    const authorBalanceAfter = await provider.connection.getBalance(author.publicKey);
    const authorReceived = authorBalanceAfter - authorBalanceBefore;
    const expected60Percent = price.toNumber() * 0.6;
    
    // Allow small deviation for rent
    assert.approximately(
      authorReceived,
      expected60Percent,
      0.01 * anchor.web3.LAMPORTS_PER_SOL,
      "Author should receive ~60% of payment"
    );
    
    console.log("✅ Revenue split verified:");
    console.log("  Price:", price.toNumber() / anchor.web3.LAMPORTS_PER_SOL, "SOL");
    console.log("  Author received:", authorReceived / anchor.web3.LAMPORTS_PER_SOL, "SOL (~60%)");
    console.log("  Expected:", expected60Percent / anchor.web3.LAMPORTS_PER_SOL, "SOL");
    console.log("  Voucher pool (40%):", (price.toNumber() * 0.4) / anchor.web3.LAMPORTS_PER_SOL, "SOL");
  });
});
