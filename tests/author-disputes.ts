import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { ReputationOracle } from "../target/types/reputation_oracle";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import { assert } from "chai";

describe("author-disputes", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace
    .ReputationOracle as Program<ReputationOracle>;

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
  let paidVouchOne: PublicKey;
  let paidVouchTwo: PublicKey;
  let freeVouchOne: PublicKey;
  let freeVouchTwo: PublicKey;
  let authorBond: PublicKey;
  let otherAuthorBond: PublicKey;
  let skillListing: PublicKey;
  let freeSkillListing: PublicKey;
  let purchase: PublicKey;
  let freeSkillId: string;
  let slashPercentage = 50;

  let stakeAmount: anchor.BN;
  let authorBondAmount: anchor.BN;

  function getAuthorBondPda(authorKey: PublicKey): PublicKey {
    const [bond] = PublicKey.findProgramAddressSync(
      [Buffer.from("author_bond"), authorKey.toBuffer()],
      program.programId
    );
    return bond;
  }

  function toDisputeSeed(disputeId: anchor.BN): Buffer {
    const seed = Buffer.alloc(8);
    seed.writeBigUInt64LE(BigInt(disputeId.toString()));
    return seed;
  }

  function getAuthorDisputePda(
    authorKey: PublicKey,
    disputeId: anchor.BN
  ): PublicKey {
    const [authorDispute] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("author_dispute"),
        authorKey.toBuffer(),
        toDisputeSeed(disputeId),
      ],
      program.programId
    );
    return authorDispute;
  }

  function getAuthorDisputeLinkPda(
    authorDispute: PublicKey,
    vouch: PublicKey
  ): PublicKey {
    const [link] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("author_dispute_vouch_link"),
        authorDispute.toBuffer(),
        vouch.toBuffer(),
      ],
      program.programId
    );
    return link;
  }

  function getRemainingAccounts(
    authorDispute: PublicKey,
    vouches: PublicKey[]
  ) {
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

  function getResolveRemainingAccounts(
    authorDispute: PublicKey,
    entries: Array<{ vouch: PublicKey; voucherProfile: PublicKey }>
  ) {
    return entries.flatMap(({ vouch, voucherProfile }) => [
      {
        pubkey: getAuthorDisputeLinkPda(authorDispute, vouch),
        isWritable: false,
        isSigner: false,
      },
      {
        pubkey: vouch,
        isWritable: true,
        isSigner: false,
      },
      {
        pubkey: voucherProfile,
        isWritable: true,
        isSigner: false,
      },
    ]);
  }

  async function expectFailure(
    promise: Promise<unknown>,
    expectedMessage: string
  ) {
    try {
      await promise;
      assert.fail(`Expected failure containing "${expectedMessage}"`);
    } catch (error: any) {
      const message = String(error?.message ?? error ?? "");
      assert.include(message, expectedMessage);
    }
  }

  function computeSlashAmount(amountLamports: number): number {
    return Math.floor((amountLamports * slashPercentage) / 100);
  }

  before(async () => {
    author = Keypair.generate();
    otherAuthor = Keypair.generate();
    voucherOne = Keypair.generate();
    voucherTwo = Keypair.generate();
    challenger = Keypair.generate();
    buyer = Keypair.generate();

    await Promise.all([
      provider.connection.requestAirdrop(
        author.publicKey,
        10 * anchor.web3.LAMPORTS_PER_SOL
      ),
      provider.connection.requestAirdrop(
        otherAuthor.publicKey,
        10 * anchor.web3.LAMPORTS_PER_SOL
      ),
      provider.connection.requestAirdrop(
        voucherOne.publicKey,
        10 * anchor.web3.LAMPORTS_PER_SOL
      ),
      provider.connection.requestAirdrop(
        voucherTwo.publicKey,
        10 * anchor.web3.LAMPORTS_PER_SOL
      ),
      provider.connection.requestAirdrop(
        challenger.publicKey,
        10 * anchor.web3.LAMPORTS_PER_SOL
      ),
      provider.connection.requestAirdrop(
        buyer.publicKey,
        10 * anchor.web3.LAMPORTS_PER_SOL
      ),
    ]);

    await new Promise((resolve) => setTimeout(resolve, 2000));

    try {
      await program.methods
        .initializeConfig(
          new anchor.BN(0.01 * anchor.web3.LAMPORTS_PER_SOL),
          new anchor.BN(0.1 * anchor.web3.LAMPORTS_PER_SOL),
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

    const configAccount = await program.account.reputationConfig.fetch(configPda);
    slashPercentage = configAccount.slashPercentage;
    const minimumBondLamports = Math.max(
      configAccount.minAuthorBondForFreeListing.toNumber(),
      0.1 * anchor.web3.LAMPORTS_PER_SOL
    );
    const normalizedBondLamports =
      minimumBondLamports % 2 === 0
        ? minimumBondLamports
        : minimumBondLamports + 1;
    authorBondAmount = new anchor.BN(normalizedBondLamports);
    stakeAmount = new anchor.BN(normalizedBondLamports);

    [authorProfile] = PublicKey.findProgramAddressSync(
      [Buffer.from("agent"), author.publicKey.toBuffer()],
      program.programId
    );
    authorBond = getAuthorBondPda(author.publicKey);
    otherAuthorBond = getAuthorBondPda(otherAuthor.publicKey);
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

    await program.methods
      .depositAuthorBond(authorBondAmount)
      .accountsPartial({
        authorBond,
        authorProfile,
        config: configPda,
        author: author.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([author])
      .rpc();

    await program.methods
      .depositAuthorBond(authorBondAmount)
      .accountsPartial({
        authorBond: otherAuthorBond,
        authorProfile: otherAuthorProfile,
        config: configPda,
        author: otherAuthor.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([otherAuthor])
      .rpc();

    [paidVouchOne] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("vouch"),
        voucherOneProfile.toBuffer(),
        authorProfile.toBuffer(),
      ],
      program.programId
    );
    [paidVouchTwo] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("vouch"),
        voucherTwoProfile.toBuffer(),
        authorProfile.toBuffer(),
      ],
      program.programId
    );
    [freeVouchOne] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("vouch"),
        voucherOneProfile.toBuffer(),
        otherAuthorProfile.toBuffer(),
      ],
      program.programId
    );
    [freeVouchTwo] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("vouch"),
        voucherTwoProfile.toBuffer(),
        otherAuthorProfile.toBuffer(),
      ],
      program.programId
    );

    await program.methods
      .vouch(stakeAmount)
      .accountsPartial({
        vouch: paidVouchOne,
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
        vouch: paidVouchTwo,
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
        vouch: freeVouchOne,
        voucherProfile: voucherOneProfile,
        voucheeProfile: otherAuthorProfile,
        config: configPda,
        voucher: voucherOne.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([voucherOne])
      .rpc();

    await program.methods
      .vouch(stakeAmount)
      .accountsPartial({
        vouch: freeVouchTwo,
        voucherProfile: voucherTwoProfile,
        voucheeProfile: otherAuthorProfile,
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
      .accountsPartial({
        skillListing,
        authorProfile,
        config: configPda,
        authorBond: null,
        author: author.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([author])
      .rpc();

    freeSkillId = `free-ad-${Date.now()}`;
    [freeSkillListing] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("skill"),
        otherAuthor.publicKey.toBuffer(),
        Buffer.from(freeSkillId),
      ],
      program.programId
    );

    await program.methods
      .createSkillListing(
        freeSkillId,
        "ipfs://author-dispute-free-skill",
        "Author Dispute Free Skill",
        "Free skill used to test bond-only author disputes",
        new anchor.BN(0)
      )
      .accountsPartial({
        skillListing: freeSkillListing,
        authorProfile: otherAuthorProfile,
        config: configPda,
        authorBond: otherAuthorBond,
        author: otherAuthor.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([otherAuthor])
      .rpc();

    [purchase] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("purchase"),
        buyer.publicKey.toBuffer(),
        skillListing.toBuffer(),
      ],
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

  it("requires every author dispute to reference a skill listing", async () => {
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
          purchase: null,
          challenger: challenger.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([challenger])
        .rpc(),
      "skillListing"
    );

    const account = await provider.connection.getAccountInfo(authorDispute);
    assert.equal(account, null);
  });

  it("rejects duplicate and mismatched backing vouches", async () => {
    const duplicateDisputeId = new anchor.BN(2);
    const duplicateAuthorDispute = getAuthorDisputePda(
      author.publicKey,
      duplicateDisputeId
    );

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
          skillListing,
          purchase: null,
          challenger: challenger.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .remainingAccounts(
          getRemainingAccounts(duplicateAuthorDispute, [paidVouchOne, paidVouchOne])
        )
        .signers([challenger])
        .rpc(),
      "Duplicate backing vouches are not allowed"
    );

    const mismatchedDisputeId = new anchor.BN(3);
    const mismatchedAuthorDispute = getAuthorDisputePda(
      author.publicKey,
      mismatchedDisputeId
    );

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
          skillListing,
          purchase: null,
          challenger: challenger.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .remainingAccounts(
          getRemainingAccounts(mismatchedAuthorDispute, [
            paidVouchOne,
            freeVouchOne,
          ])
        )
        .signers([challenger])
        .rpc(),
      "does not belong to the disputed author"
    );
  });

  it("rejects purchases that do not match the disputed skill listing", async () => {
    const disputeId = new anchor.BN(4);
    const authorDispute = getAuthorDisputePda(otherAuthor.publicKey, disputeId);

    await expectFailure(
      program.methods
        .openAuthorDispute(
          disputeId,
          { failedDelivery: {} },
          "https://example.com/evidence/purchase-mismatch.json"
        )
        .accountsPartial({
          authorDispute,
          authorProfile: otherAuthorProfile,
          config: configPda,
          skillListing: freeSkillListing,
          purchase,
          challenger: challenger.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([challenger])
        .rpc(),
      "provided purchase does not belong to the provided skill listing"
    );
  });

  it("opens and resolves a free-skill dispute with a voucher snapshot but bond-only settlement", async () => {
    const disputeId = new anchor.BN(5);
    const authorDispute = getAuthorDisputePda(otherAuthor.publicKey, disputeId);
    const linkOne = getAuthorDisputeLinkPda(authorDispute, freeVouchOne);
    const linkTwo = getAuthorDisputeLinkPda(authorDispute, freeVouchTwo);
    const expectedBondOnlySlash = computeSlashAmount(authorBondAmount.toNumber());

    const otherAuthorBondLamportsBefore = await provider.connection.getBalance(
      otherAuthorBond
    );
    const freeVouchOneLamportsBefore = await provider.connection.getBalance(
      freeVouchOne
    );
    const freeVouchTwoLamportsBefore = await provider.connection.getBalance(
      freeVouchTwo
    );

    await program.methods
      .openAuthorDispute(
        disputeId,
        { maliciousSkill: {} },
        "https://example.com/evidence/free-skill.json"
      )
      .accountsPartial({
        authorDispute,
        authorProfile: otherAuthorProfile,
        config: configPda,
        skillListing: freeSkillListing,
        purchase: null,
        challenger: challenger.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .remainingAccounts(
        getRemainingAccounts(authorDispute, [freeVouchOne, freeVouchTwo])
      )
      .signers([challenger])
      .rpc();

    const opened = await program.account.authorDispute.fetch(authorDispute);
    assert.equal(opened.skillListing.toBase58(), freeSkillListing.toBase58());
    assert.equal(opened.skillPriceLamportsSnapshot.toNumber(), 0);
    assert.equal(opened.liabilityScope.authorBondOnly !== undefined, true);
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
        authorProfile: otherAuthorProfile,
        authorBond: otherAuthorBond,
        config: configPda,
        authority: provider.wallet.publicKey,
        challenger: challenger.publicKey,
      })
      .rpc();

    const resolved = await program.account.authorDispute.fetch(authorDispute);
    assert.equal(resolved.status.resolved !== undefined, true);
    assert.equal(resolved.ruling?.upheld !== undefined, true);
    assert.equal(resolved.liabilityScope.authorBondOnly !== undefined, true);

    const otherAuthorBondAccount = await program.account.authorBond.fetch(
      otherAuthorBond
    );
    const freeVouchOneAccount = await program.account.vouch.fetch(freeVouchOne);
    const freeVouchTwoAccount = await program.account.vouch.fetch(freeVouchTwo);
    assert.equal(
      otherAuthorBondAccount.amount.toNumber(),
      authorBondAmount.toNumber() - expectedBondOnlySlash
    );
    assert.equal(freeVouchOneAccount.status.active !== undefined, true);
    assert.equal(freeVouchTwoAccount.status.active !== undefined, true);

    const otherAuthorProfileAccount = await program.account.agentProfile.fetch(
      otherAuthorProfile
    );
    assert.equal(otherAuthorProfileAccount.totalVouchesReceived, 2);
    assert.equal(
      otherAuthorProfileAccount.authorBondLamports.toNumber(),
      authorBondAmount.toNumber() - expectedBondOnlySlash
    );
    assert.equal(
      Number(otherAuthorProfileAccount.totalStakedFor),
      stakeAmount.toNumber() * 2
    );
    assert.equal(otherAuthorProfileAccount.openAuthorDisputes, 0);

    const otherAuthorBondLamportsAfter = await provider.connection.getBalance(
      otherAuthorBond
    );
    const freeVouchOneLamportsAfter = await provider.connection.getBalance(
      freeVouchOne
    );
    const freeVouchTwoLamportsAfter = await provider.connection.getBalance(
      freeVouchTwo
    );
    assert.equal(
      otherAuthorBondLamportsBefore - otherAuthorBondLamportsAfter,
      expectedBondOnlySlash
    );
    assert.equal(freeVouchOneLamportsBefore, freeVouchOneLamportsAfter);
    assert.equal(freeVouchTwoLamportsBefore, freeVouchTwoLamportsAfter);
  });

  it("keeps free-skill disputes bond-only even if the listing price changes later", async () => {
    const disputeId = new anchor.BN(6);
    const authorDispute = getAuthorDisputePda(otherAuthor.publicKey, disputeId);
    const remainingBondBefore = (
      await program.account.authorBond.fetch(otherAuthorBond)
    ).amount.toNumber();
    const expectedBondOnlySlash = computeSlashAmount(remainingBondBefore);
    const freeVouchOneLamportsBefore = await provider.connection.getBalance(
      freeVouchOne
    );
    const freeVouchTwoLamportsBefore = await provider.connection.getBalance(
      freeVouchTwo
    );

    await program.methods
      .openAuthorDispute(
        disputeId,
        { fraudulentClaims: {} },
        "https://example.com/evidence/free-skill-repriced.json"
      )
      .accountsPartial({
        authorDispute,
        authorProfile: otherAuthorProfile,
        config: configPda,
        skillListing: freeSkillListing,
        purchase: null,
        challenger: challenger.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .remainingAccounts(
        getRemainingAccounts(authorDispute, [freeVouchOne, freeVouchTwo])
      )
      .signers([challenger])
      .rpc();

    await program.methods
      .updateSkillListing(
        freeSkillId,
        "ipfs://author-dispute-free-skill-paid",
        "Author Dispute Free Skill",
        "Repriced after dispute open",
        new anchor.BN(0.2 * anchor.web3.LAMPORTS_PER_SOL)
      )
      .accountsPartial({
        skillListing: freeSkillListing,
        authorProfile: otherAuthorProfile,
        config: configPda,
        authorBond: null,
        author: otherAuthor.publicKey,
      })
      .signers([otherAuthor])
      .rpc();

    await program.methods
      .resolveAuthorDispute(disputeId, { upheld: {} })
      .accountsPartial({
        authorDispute,
        authorProfile: otherAuthorProfile,
        authorBond: otherAuthorBond,
        config: configPda,
        authority: provider.wallet.publicKey,
        challenger: challenger.publicKey,
      })
      .rpc();

    const resolved = await program.account.authorDispute.fetch(authorDispute);
    assert.equal(resolved.liabilityScope.authorBondOnly !== undefined, true);
    assert.equal(resolved.skillPriceLamportsSnapshot.toNumber(), 0);

    const otherAuthorBondAccount = await program.account.authorBond.fetch(
      otherAuthorBond
    );
    assert.equal(
      otherAuthorBondAccount.amount.toNumber(),
      remainingBondBefore - expectedBondOnlySlash
    );
    assert.equal(
      await provider.connection.getBalance(freeVouchOne),
      freeVouchOneLamportsBefore
    );
    assert.equal(
      await provider.connection.getBalance(freeVouchTwo),
      freeVouchTwoLamportsBefore
    );
  });

  it("opens and resolves a paid-skill dispute with voucher slashing after AuthorBond", async () => {
    const disputeId = new anchor.BN(7);
    const authorDispute = getAuthorDisputePda(author.publicKey, disputeId);
    const linkOne = getAuthorDisputeLinkPda(authorDispute, paidVouchOne);
    const linkTwo = getAuthorDisputeLinkPda(authorDispute, paidVouchTwo);
    const bondLamports = authorBondAmount.toNumber();
    const expectedTotalSlash = computeSlashAmount(bondLamports * 3);
    const slashPerVouch = bondLamports / 4;

    const challengerBalanceBefore = await provider.connection.getBalance(
      challenger.publicKey
    );
    const authorBondLamportsBefore = await provider.connection.getBalance(
      authorBond
    );
    const vouchOneLamportsBefore = await provider.connection.getBalance(
      paidVouchOne
    );
    const vouchTwoLamportsBefore = await provider.connection.getBalance(
      paidVouchTwo
    );

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
      .remainingAccounts(
        getRemainingAccounts(authorDispute, [paidVouchOne, paidVouchTwo])
      )
      .signers([challenger])
      .rpc();

    const opened = await program.account.authorDispute.fetch(authorDispute);
    assert.equal(opened.skillListing.toBase58(), skillListing.toBase58());
    assert.equal(opened.skillPriceLamportsSnapshot.toNumber(), 250_000_000);
    assert.equal(opened.liabilityScope.authorBondThenVouchers !== undefined, true);
    assert.equal(opened.purchase?.toBase58(), purchase.toBase58());
    assert.equal(opened.backingVouchCountSnapshot, 2);
    assert.equal(opened.linkedVouchCount, 2);

    const linkedOne = await provider.connection.getAccountInfo(linkOne);
    const linkedTwo = await provider.connection.getAccountInfo(linkTwo);
    assert.isNotNull(linkedOne);
    assert.isNotNull(linkedTwo);

    await expectFailure(
      program.methods
        .withdrawAuthorBond(new anchor.BN(0.01 * anchor.web3.LAMPORTS_PER_SOL))
        .accountsPartial({
          authorBond,
          authorProfile,
          config: configPda,
          author: author.publicKey,
        })
        .signers([author])
        .rpc(),
      "cannot be withdrawn while author disputes are open"
    );

    await program.methods
      .resolveAuthorDispute(disputeId, { upheld: {} })
      .accountsPartial({
        authorDispute,
        authorProfile,
        authorBond,
        config: configPda,
        authority: provider.wallet.publicKey,
        challenger: challenger.publicKey,
      })
      .remainingAccounts(
        getResolveRemainingAccounts(authorDispute, [
          { vouch: paidVouchOne, voucherProfile: voucherOneProfile },
          { vouch: paidVouchTwo, voucherProfile: voucherTwoProfile },
        ])
      )
      .rpc();

    const resolved = await program.account.authorDispute.fetch(authorDispute);
    assert.equal(resolved.status.resolved !== undefined, true);
    assert.equal(resolved.ruling?.upheld !== undefined, true);
    assert.equal(resolved.linkedVouchCount, resolved.backingVouchCountSnapshot);

    const authorBondAccount = await program.account.authorBond.fetch(authorBond);
    const vouchOneAccount = await program.account.vouch.fetch(paidVouchOne);
    const vouchTwoAccount = await program.account.vouch.fetch(paidVouchTwo);
    assert.equal(authorBondAccount.amount.toNumber(), 0);
    assert.equal(vouchOneAccount.status.slashed !== undefined, true);
    assert.equal(vouchTwoAccount.status.slashed !== undefined, true);

    const voucherOneProfileAccount = await program.account.agentProfile.fetch(
      voucherOneProfile
    );
    const voucherTwoProfileAccount = await program.account.agentProfile.fetch(
      voucherTwoProfile
    );
    const authorProfileAccount = await program.account.agentProfile.fetch(
      authorProfile
    );
    assert.equal(voucherOneProfileAccount.totalVouchesGiven, 1);
    assert.equal(voucherTwoProfileAccount.totalVouchesGiven, 1);
    assert.equal(authorProfileAccount.totalVouchesReceived, 0);
    assert.equal(authorProfileAccount.authorBondLamports.toNumber(), 0);
    assert.equal(authorProfileAccount.openAuthorDisputes, 0);
    assert.equal(Number(authorProfileAccount.totalStakedFor), 0);

    const authorBondLamportsAfter = await provider.connection.getBalance(authorBond);
    const vouchOneLamportsAfter = await provider.connection.getBalance(
      paidVouchOne
    );
    const vouchTwoLamportsAfter = await provider.connection.getBalance(
      paidVouchTwo
    );
    assert.equal(
      authorBondLamportsBefore - authorBondLamportsAfter,
      authorBondAmount.toNumber()
    );
    assert.equal(vouchOneLamportsBefore - vouchOneLamportsAfter, slashPerVouch);
    assert.equal(vouchTwoLamportsBefore - vouchTwoLamportsAfter, slashPerVouch);

    const challengerBalanceAfter = await provider.connection.getBalance(
      challenger.publicKey
    );
    assert.isTrue(
      challengerBalanceAfter >
        challengerBalanceBefore +
          expectedTotalSlash -
          0.02 * anchor.web3.LAMPORTS_PER_SOL
    );
  });

  it("rejects restaking a relationship after author-wide slashing", async () => {
    await expectFailure(
      program.methods
        .vouch(stakeAmount)
        .accountsPartial({
          vouch: paidVouchOne,
          voucherProfile: voucherOneProfile,
          voucheeProfile: authorProfile,
          config: configPda,
          voucher: voucherOne.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([voucherOne])
        .rpc(),
      "cannot accept new stake in its current state"
    );
  });
});
