import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { ReputationOracle } from "../target/types/reputation_oracle";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import { assert } from "chai";

describe("author-disputes", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.ReputationOracle as Program<ReputationOracle>;

  const [configPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    program.programId
  );

  let author: Keypair;
  let voucherOne: Keypair;
  let voucherTwo: Keypair;
  let challenger: Keypair;
  let buyer: Keypair;

  let authorProfile: PublicKey;
  let voucherOneProfile: PublicKey;
  let voucherTwoProfile: PublicKey;
  let vouchOne: PublicKey;
  let vouchTwo: PublicKey;
  let skillListing: PublicKey;
  let purchase: PublicKey;

  const stakeAmount = new anchor.BN(0.05 * anchor.web3.LAMPORTS_PER_SOL);

  before(async () => {
    author = Keypair.generate();
    voucherOne = Keypair.generate();
    voucherTwo = Keypair.generate();
    challenger = Keypair.generate();
    buyer = Keypair.generate();

    await Promise.all([
      provider.connection.requestAirdrop(author.publicKey, 10 * anchor.web3.LAMPORTS_PER_SOL),
      provider.connection.requestAirdrop(voucherOne.publicKey, 10 * anchor.web3.LAMPORTS_PER_SOL),
      provider.connection.requestAirdrop(voucherTwo.publicKey, 10 * anchor.web3.LAMPORTS_PER_SOL),
      provider.connection.requestAirdrop(challenger.publicKey, 10 * anchor.web3.LAMPORTS_PER_SOL),
      provider.connection.requestAirdrop(buyer.publicKey, 10 * anchor.web3.LAMPORTS_PER_SOL),
    ]);

    await new Promise((resolve) => setTimeout(resolve, 2000));

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
      // Shared local validator state may already have the config.
    }

    [authorProfile] = PublicKey.findProgramAddressSync(
      [Buffer.from("agent"), author.publicKey.toBuffer()],
      program.programId
    );
    [voucherOneProfile] = PublicKey.findProgramAddressSync(
      [Buffer.from("agent"), voucherOne.publicKey.toBuffer()],
      program.programId
    );
    [voucherTwoProfile] = PublicKey.findProgramAddressSync(
      [Buffer.from("agent"), voucherTwo.publicKey.toBuffer()],
      program.programId
    );

    await program.methods
      .registerAgent("https://author-dispute.author")
      .accounts({
        agentProfile: authorProfile,
        authority: author.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([author])
      .rpc();

    await program.methods
      .registerAgent("https://author-dispute.voucher-one")
      .accounts({
        agentProfile: voucherOneProfile,
        authority: voucherOne.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([voucherOne])
      .rpc();

    await program.methods
      .registerAgent("https://author-dispute.voucher-two")
      .accounts({
        agentProfile: voucherTwoProfile,
        authority: voucherTwo.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([voucherTwo])
      .rpc();

    [vouchOne] = PublicKey.findProgramAddressSync(
      [Buffer.from("vouch"), voucherOneProfile.toBuffer(), authorProfile.toBuffer()],
      program.programId
    );
    [vouchTwo] = PublicKey.findProgramAddressSync(
      [Buffer.from("vouch"), voucherTwoProfile.toBuffer(), authorProfile.toBuffer()],
      program.programId
    );

    await program.methods
      .vouch(stakeAmount)
      .accounts({
        vouch: vouchOne,
        voucherProfile: voucherOneProfile,
        voucheeProfile: authorProfile,
        config: configPda,
        voucher: voucherOne.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([voucherOne])
      .rpc();

    await program.methods
      .vouch(stakeAmount)
      .accounts({
        vouch: vouchTwo,
        voucherProfile: voucherTwoProfile,
        voucheeProfile: authorProfile,
        config: configPda,
        voucher: voucherTwo.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([voucherTwo])
      .rpc();

    const skillId = `ad-${Date.now()}`;
    [skillListing] = PublicKey.findProgramAddressSync(
      [Buffer.from("skill"), author.publicKey.toBuffer(), Buffer.from(skillId)],
      program.programId
    );

    await program.methods
      .createSkillListing(
        skillId,
        "ipfs://author-dispute-skill",
        "Author Dispute Skill",
        "Skill used to test author-native disputes",
        new anchor.BN(0.25 * anchor.web3.LAMPORTS_PER_SOL)
      )
      .accounts({
        skillListing,
        authorProfile,
        author: author.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([author])
      .rpc();

    [purchase] = PublicKey.findProgramAddressSync(
      [Buffer.from("purchase"), buyer.publicKey.toBuffer(), skillListing.toBuffer()],
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
  });

  it("opens an author dispute without a skill or purchase reference", async () => {
    const disputeId = new anchor.BN(1);
    const [authorDispute] = PublicKey.findProgramAddressSync(
      [Buffer.from("author_dispute"), author.publicKey.toBuffer(), Buffer.from(Uint8Array.of(1, 0, 0, 0, 0, 0, 0, 0))],
      program.programId
    );

    await program.methods
      .openAuthorDispute(disputeId, { other: {} }, "https://example.com/evidence/no-skill.json")
      .accounts({
        authorDispute,
        authorProfile,
        config: configPda,
        skillListing: null,
        purchase: null,
        challenger: challenger.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([challenger])
      .rpc();

    const authorDisputeAccount = await program.account.authorDispute.fetch(authorDispute);
    assert.equal(authorDisputeAccount.author.toBase58(), author.publicKey.toBase58());
    assert.equal(authorDisputeAccount.challenger.toBase58(), challenger.publicKey.toBase58());
    assert.equal(authorDisputeAccount.skillListing, null);
    assert.equal(authorDisputeAccount.purchase, null);
    assert.equal(authorDisputeAccount.status.open !== undefined, true);
  });

  it("opens, links, and resolves an author dispute without changing low-level vouch state", async () => {
    const disputeId = new anchor.BN(2);
    const disputeSeed = Buffer.alloc(8);
    disputeSeed.writeBigUInt64LE(BigInt(disputeId.toString()));
    const [authorDispute] = PublicKey.findProgramAddressSync(
      [Buffer.from("author_dispute"), author.publicKey.toBuffer(), disputeSeed],
      program.programId
    );
    const [linkOne] = PublicKey.findProgramAddressSync(
      [Buffer.from("author_dispute_vouch_link"), authorDispute.toBuffer(), vouchOne.toBuffer()],
      program.programId
    );
    const [linkTwo] = PublicKey.findProgramAddressSync(
      [Buffer.from("author_dispute_vouch_link"), authorDispute.toBuffer(), vouchTwo.toBuffer()],
      program.programId
    );

    const challengerBalanceBefore = await provider.connection.getBalance(challenger.publicKey);

    await program.methods
      .openAuthorDispute(
        disputeId,
        { maliciousSkill: {} },
        "https://example.com/evidence/malicious-skill.json"
      )
      .accounts({
        authorDispute,
        authorProfile,
        config: configPda,
        skillListing,
        purchase,
        challenger: challenger.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([challenger])
      .rpc();

    await program.methods
      .linkAuthorDisputeVouch(disputeId)
      .accounts({
        authorDispute,
        authorDisputeVouchLink: linkOne,
        vouch: vouchOne,
        authorProfile,
        challenger: challenger.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([challenger])
      .rpc();

    await program.methods
      .linkAuthorDisputeVouch(disputeId)
      .accounts({
        authorDispute,
        authorDisputeVouchLink: linkTwo,
        vouch: vouchTwo,
        authorProfile,
        challenger: challenger.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([challenger])
      .rpc();

    const opened = await program.account.authorDispute.fetch(authorDispute);
    assert.equal(opened.skillListing?.toBase58(), skillListing.toBase58());
    assert.equal(opened.purchase?.toBase58(), purchase.toBase58());
    assert.equal(opened.linkedVouchCount, 2);

    const linkedOne = await program.account.authorDisputeVouchLink.fetch(linkOne);
    const linkedTwo = await program.account.authorDisputeVouchLink.fetch(linkTwo);
    assert.equal(linkedOne.vouch.toBase58(), vouchOne.toBase58());
    assert.equal(linkedTwo.vouch.toBase58(), vouchTwo.toBase58());

    await program.methods
      .resolveAuthorDispute(disputeId, { upheld: {} })
      .accounts({
        authorDispute,
        authorProfile,
        config: configPda,
        authority: provider.wallet.publicKey,
        challenger: challenger.publicKey,
      })
      .rpc();

    const resolved = await program.account.authorDispute.fetch(authorDispute);
    assert.equal(resolved.status.resolved !== undefined, true);
    assert.equal(resolved.ruling?.upheld !== undefined, true);

    const vouchOneAccount = await program.account.vouch.fetch(vouchOne);
    const vouchTwoAccount = await program.account.vouch.fetch(vouchTwo);
    assert.equal(vouchOneAccount.status.active !== undefined, true);
    assert.equal(vouchTwoAccount.status.active !== undefined, true);

    const challengerBalanceAfter = await provider.connection.getBalance(challenger.publicKey);
    assert.isTrue(challengerBalanceAfter > challengerBalanceBefore - 0.02 * anchor.web3.LAMPORTS_PER_SOL);
  });
});
