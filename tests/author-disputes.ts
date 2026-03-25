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
  let otherAuthor: Keypair;
  let voucherOne: Keypair;
  let voucherTwo: Keypair;
  let challenger: Keypair;
  let buyer: Keypair;

  let authorProfile: PublicKey;
  let otherAuthorProfile: PublicKey;
  let voucherOneProfile: PublicKey;
  let voucherTwoProfile: PublicKey;
  let vouchOne: PublicKey;
  let vouchTwo: PublicKey;
  let foreignVouch: PublicKey;
  let skillListing: PublicKey;
  let purchase: PublicKey;

  const stakeAmount = new anchor.BN(0.05 * anchor.web3.LAMPORTS_PER_SOL);

  function toDisputeSeed(disputeId: anchor.BN): Buffer {
    const seed = Buffer.alloc(8);
    seed.writeBigUInt64LE(BigInt(disputeId.toString()));
    return seed;
  }

  function getAuthorDisputePda(authorKey: PublicKey, disputeId: anchor.BN): PublicKey {
    const [authorDispute] = PublicKey.findProgramAddressSync(
      [Buffer.from("author_dispute"), authorKey.toBuffer(), toDisputeSeed(disputeId)],
      program.programId
    );
    return authorDispute;
  }

  function getAuthorDisputeLinkPda(authorDispute: PublicKey, vouch: PublicKey): PublicKey {
    const [link] = PublicKey.findProgramAddressSync(
      [Buffer.from("author_dispute_vouch_link"), authorDispute.toBuffer(), vouch.toBuffer()],
      program.programId
    );
    return link;
  }

  function getRemainingAccounts(authorDispute: PublicKey, vouches: PublicKey[]) {
    return vouches.flatMap((vouch) => [
      {
        pubkey: getAuthorDisputeLinkPda(authorDispute, vouch),
        isWritable: true,
        isSigner: false,
      },
      {
        pubkey: vouch,
        isWritable: false,
        isSigner: false,
      },
    ]);
  }

  async function expectFailure(promise: Promise<unknown>, expectedMessage: string) {
    try {
      await promise;
      assert.fail(`Expected failure containing "${expectedMessage}"`);
    } catch (error: any) {
      const message = String(error?.message ?? error ?? "");
      assert.include(message, expectedMessage);
    }
  }

  before(async () => {
    author = Keypair.generate();
    otherAuthor = Keypair.generate();
    voucherOne = Keypair.generate();
    voucherTwo = Keypair.generate();
    challenger = Keypair.generate();
    buyer = Keypair.generate();

    await Promise.all([
      provider.connection.requestAirdrop(author.publicKey, 10 * anchor.web3.LAMPORTS_PER_SOL),
      provider.connection.requestAirdrop(otherAuthor.publicKey, 10 * anchor.web3.LAMPORTS_PER_SOL),
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
        .accountsPartial({
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
    [otherAuthorProfile] = PublicKey.findProgramAddressSync(
      [Buffer.from("agent"), otherAuthor.publicKey.toBuffer()],
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
      .accountsPartial({
        agentProfile: authorProfile,
        authority: author.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([author])
      .rpc();

    await program.methods
      .registerAgent("https://author-dispute.other-author")
      .accountsPartial({
        agentProfile: otherAuthorProfile,
        authority: otherAuthor.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([otherAuthor])
      .rpc();

    await program.methods
      .registerAgent("https://author-dispute.voucher-one")
      .accountsPartial({
        agentProfile: voucherOneProfile,
        authority: voucherOne.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([voucherOne])
      .rpc();

    await program.methods
      .registerAgent("https://author-dispute.voucher-two")
      .accountsPartial({
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
    [foreignVouch] = PublicKey.findProgramAddressSync(
      [Buffer.from("vouch"), voucherOneProfile.toBuffer(), otherAuthorProfile.toBuffer()],
      program.programId
    );

    await program.methods
      .vouch(stakeAmount)
      .accountsPartial({
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
      .accountsPartial({
        vouch: vouchTwo,
        voucherProfile: voucherTwoProfile,
        voucheeProfile: authorProfile,
        config: configPda,
        voucher: voucherTwo.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([voucherTwo])
      .rpc();

    await program.methods
      .vouch(stakeAmount)
      .accountsPartial({
        vouch: foreignVouch,
        voucherProfile: voucherOneProfile,
        voucheeProfile: otherAuthorProfile,
        config: configPda,
        voucher: voucherOne.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([voucherOne])
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
      .accountsPartial({
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
      .accountsPartial({
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

  it("rejects author disputes that do not carry the full backing snapshot", async () => {
    const disputeId = new anchor.BN(1);
    const authorDispute = getAuthorDisputePda(author.publicKey, disputeId);

    await expectFailure(
      program.methods
        .openAuthorDispute(
          disputeId,
          { other: {} },
          "https://example.com/evidence/partial.json"
        )
        .accountsPartial({
          authorDispute,
          authorProfile,
          config: configPda,
          skillListing: null,
          purchase: null,
          challenger: challenger.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .remainingAccounts(getRemainingAccounts(authorDispute, [vouchOne]))
        .signers([challenger])
        .rpc(),
      "Author disputes must snapshot the full author-wide backing set"
    );

    const account = await provider.connection.getAccountInfo(authorDispute);
    assert.equal(account, null);
  });

  it("rejects duplicate and mismatched backing vouches", async () => {
    const duplicateDisputeId = new anchor.BN(2);
    const duplicateAuthorDispute = getAuthorDisputePda(author.publicKey, duplicateDisputeId);

    await expectFailure(
      program.methods
        .openAuthorDispute(
          duplicateDisputeId,
          { other: {} },
          "https://example.com/evidence/duplicate.json"
        )
        .accountsPartial({
          authorDispute: duplicateAuthorDispute,
          authorProfile,
          config: configPda,
          skillListing: null,
          purchase: null,
          challenger: challenger.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .remainingAccounts(getRemainingAccounts(duplicateAuthorDispute, [vouchOne, vouchOne]))
        .signers([challenger])
        .rpc(),
      "Duplicate backing vouches are not allowed"
    );

    const mismatchedDisputeId = new anchor.BN(3);
    const mismatchedAuthorDispute = getAuthorDisputePda(author.publicKey, mismatchedDisputeId);

    await expectFailure(
      program.methods
        .openAuthorDispute(
          mismatchedDisputeId,
          { other: {} },
          "https://example.com/evidence/mismatched.json"
        )
        .accountsPartial({
          authorDispute: mismatchedAuthorDispute,
          authorProfile,
          config: configPda,
          skillListing: null,
          purchase: null,
          challenger: challenger.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .remainingAccounts(getRemainingAccounts(mismatchedAuthorDispute, [vouchOne, foreignVouch]))
        .signers([challenger])
        .rpc(),
      "does not belong to the disputed author"
    );
  });

  it("opens and resolves a skill-linked author dispute with the full author-wide backing snapshot", async () => {
    const disputeId = new anchor.BN(4);
    const authorDispute = getAuthorDisputePda(author.publicKey, disputeId);
    const linkOne = getAuthorDisputeLinkPda(authorDispute, vouchOne);
    const linkTwo = getAuthorDisputeLinkPda(authorDispute, vouchTwo);

    const challengerBalanceBefore = await provider.connection.getBalance(challenger.publicKey);

    await program.methods
      .openAuthorDispute(
        disputeId,
        { maliciousSkill: {} },
        "https://example.com/evidence/malicious-skill.json"
      )
      .accountsPartial({
        authorDispute,
        authorProfile,
        config: configPda,
        skillListing,
        purchase,
        challenger: challenger.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .remainingAccounts(getRemainingAccounts(authorDispute, [vouchOne, vouchTwo]))
      .signers([challenger])
      .rpc();

    const opened = await program.account.authorDispute.fetch(authorDispute);
    assert.equal(opened.skillListing?.toBase58(), skillListing.toBase58());
    assert.equal(opened.purchase?.toBase58(), purchase.toBase58());
    assert.equal(opened.backingVouchCountSnapshot, 2);
    assert.equal(opened.linkedVouchCount, 2);

    const linkedOne = await provider.connection.getAccountInfo(linkOne);
    const linkedTwo = await provider.connection.getAccountInfo(linkTwo);
    assert.isNotNull(linkedOne);
    assert.isNotNull(linkedTwo);

    await program.methods
      .resolveAuthorDispute(disputeId, { upheld: {} })
      .accountsPartial({
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
    assert.equal(resolved.linkedVouchCount, resolved.backingVouchCountSnapshot);

    const vouchOneAccount = await program.account.vouch.fetch(vouchOne);
    const vouchTwoAccount = await program.account.vouch.fetch(vouchTwo);
    assert.equal(vouchOneAccount.status.active !== undefined, true);
    assert.equal(vouchTwoAccount.status.active !== undefined, true);

    const challengerBalanceAfter = await provider.connection.getBalance(challenger.publicKey);
    assert.isTrue(
      challengerBalanceAfter >
        challengerBalanceBefore - 0.02 * anchor.web3.LAMPORTS_PER_SOL
    );
  });
});
