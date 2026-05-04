import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  createMint,
  getOrCreateAssociatedTokenAccount,
  getAccount,
  mintTo,
} from "@solana/spl-token";
import { assert } from "chai";
import { Agentvouch } from "../target/types/agentvouch";

const USDC_DECIMALS = 6;
const ONE_USDC = 1_000_000;

describe("agentvouch usdc-native protocol", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Agentvouch as Program<Agentvouch>;
  const payer = (provider.wallet as anchor.Wallet).payer;

  const [config] = PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    program.programId
  );
  const [protocolTreasuryVaultAuthority] = PublicKey.findProgramAddressSync(
    [Buffer.from("treasury_vault_authority")],
    program.programId
  );
  const [protocolTreasuryVault] = PublicKey.findProgramAddressSync(
    [Buffer.from("treasury_vault")],
    program.programId
  );
  const [x402SettlementVaultAuthority] = PublicKey.findProgramAddressSync(
    [Buffer.from("x402_settlement_vault_authority")],
    program.programId
  );
  const [x402SettlementVault] = PublicKey.findProgramAddressSync(
    [Buffer.from("x402_settlement_vault")],
    program.programId
  );

  const author = Keypair.generate();
  const voucher = Keypair.generate();
  const buyer = Keypair.generate();
  const challenger = Keypair.generate();
  const configAdmin = Keypair.generate();

  let usdcMint: PublicKey;
  let authorUsdc: PublicKey;
  let voucherUsdc: PublicKey;
  let buyerUsdc: PublicKey;
  let challengerUsdc: PublicKey;

  function agentPda(authority: PublicKey): PublicKey {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("agent"), authority.toBuffer()],
      program.programId
    )[0];
  }

  function authorBondPda(authority: PublicKey): PublicKey {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("author_bond"), authority.toBuffer()],
      program.programId
    )[0];
  }

  function authorBondVaultAuthority(authority: PublicKey): PublicKey {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("author_bond_vault_authority"), authority.toBuffer()],
      program.programId
    )[0];
  }

  function authorBondVault(authority: PublicKey): PublicKey {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("author_bond_vault"), authority.toBuffer()],
      program.programId
    )[0];
  }

  function vouchPda(voucherProfile: PublicKey, authorProfile: PublicKey): PublicKey {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("vouch"), voucherProfile.toBuffer(), authorProfile.toBuffer()],
      program.programId
    )[0];
  }

  function vouchVaultAuthority(voucherProfile: PublicKey, authorProfile: PublicKey): PublicKey {
    return PublicKey.findProgramAddressSync(
      [
        Buffer.from("vouch_vault_authority"),
        voucherProfile.toBuffer(),
        authorProfile.toBuffer(),
      ],
      program.programId
    )[0];
  }

  function vouchVault(voucherProfile: PublicKey, authorProfile: PublicKey): PublicKey {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("vouch_vault"), voucherProfile.toBuffer(), authorProfile.toBuffer()],
      program.programId
    )[0];
  }

  function skillListingPda(skillId: string): PublicKey {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("skill"), author.publicKey.toBuffer(), Buffer.from(skillId)],
      program.programId
    )[0];
  }

  function rewardVaultAuthority(skillListing: PublicKey): PublicKey {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("listing_reward_vault_authority"), skillListing.toBuffer()],
      program.programId
    )[0];
  }

  function rewardVault(skillListing: PublicKey): PublicKey {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("listing_reward_vault"), skillListing.toBuffer()],
      program.programId
    )[0];
  }

  function listingVouchPosition(skillListing: PublicKey, vouch: PublicKey): PublicKey {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("listing_vouch_position"), skillListing.toBuffer(), vouch.toBuffer()],
      program.programId
    )[0];
  }

  function purchasePda(skillListing: PublicKey): PublicKey {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("purchase"), buyer.publicKey.toBuffer(), skillListing.toBuffer()],
      program.programId
    )[0];
  }

  function disputeBondVaultAuthority(authority: PublicKey, disputeId: anchor.BN): PublicKey {
    return PublicKey.findProgramAddressSync(
      [
        Buffer.from("dispute_bond_vault_authority"),
        authority.toBuffer(),
        disputeId.toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    )[0];
  }

  function disputeBondVault(authority: PublicKey, disputeId: anchor.BN): PublicKey {
    return PublicKey.findProgramAddressSync(
      [
        Buffer.from("dispute_bond_vault"),
        authority.toBuffer(),
        disputeId.toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    )[0];
  }

  function authorDisputePda(authority: PublicKey, disputeId: anchor.BN): PublicKey {
    return PublicKey.findProgramAddressSync(
      [
        Buffer.from("author_dispute"),
        authority.toBuffer(),
        disputeId.toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    )[0];
  }

  async function fundSol(keypair: Keypair) {
    const sig = await provider.connection.requestAirdrop(
      keypair.publicKey,
      5 * anchor.web3.LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(sig, "confirmed");
  }

  before(async () => {
    await Promise.all([
      fundSol(author),
      fundSol(voucher),
      fundSol(buyer),
      fundSol(challenger),
      fundSol(configAdmin),
    ]);

    usdcMint = await createMint(
      provider.connection,
      payer,
      payer.publicKey,
      null,
      USDC_DECIMALS
    );

    authorUsdc = (
      await getOrCreateAssociatedTokenAccount(
        provider.connection,
        payer,
        usdcMint,
        author.publicKey
      )
    ).address;
    voucherUsdc = (
      await getOrCreateAssociatedTokenAccount(
        provider.connection,
        payer,
        usdcMint,
        voucher.publicKey
      )
    ).address;
    buyerUsdc = (
      await getOrCreateAssociatedTokenAccount(
        provider.connection,
        payer,
        usdcMint,
        buyer.publicKey
      )
    ).address;
    challengerUsdc = (
      await getOrCreateAssociatedTokenAccount(
        provider.connection,
        payer,
        usdcMint,
        challenger.publicKey
      )
    ).address;

    await mintTo(provider.connection, payer, usdcMint, authorUsdc, payer, 20 * ONE_USDC);
    await mintTo(provider.connection, payer, usdcMint, voucherUsdc, payer, 20 * ONE_USDC);
    await mintTo(provider.connection, payer, usdcMint, buyerUsdc, payer, 20 * ONE_USDC);
    await mintTo(provider.connection, payer, usdcMint, challengerUsdc, payer, 20 * ONE_USDC);
  });

  it("runs the USDC-native publish, vouch, purchase, claim, and dispute path", async () => {
    await program.methods
      .initializeConfig(
        "solana:localnet",
        configAdmin.publicKey,
        configAdmin.publicKey,
        configAdmin.publicKey,
        configAdmin.publicKey,
        50,
        new anchor.BN(86_400)
      )
      .accounts({
        config,
        usdcMint,
        protocolTreasuryVaultAuthority,
        protocolTreasuryVault,
        x402SettlementVaultAuthority,
        x402SettlementVault,
        authority: configAdmin.publicKey,
        payer: payer.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const authorProfile = agentPda(author.publicKey);
    const voucherProfile = agentPda(voucher.publicKey);
    await program.methods
      .registerAgent("https://example.com/author.json")
      .accounts({
        agentProfile: authorProfile,
        authority: author.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([author])
      .rpc();
    await program.methods
      .registerAgent("https://example.com/voucher.json")
      .accounts({
        agentProfile: voucherProfile,
        authority: voucher.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([voucher])
      .rpc();

    const authorBond = authorBondPda(author.publicKey);
    const authorBondVaultAuth = authorBondVaultAuthority(author.publicKey);
    const authorBondTokenVault = authorBondVault(author.publicKey);
    await program.methods
      .depositAuthorBond(new anchor.BN(4 * ONE_USDC))
      .accounts({
        authorBond,
        authorProfile,
        config,
        usdcMint,
        authorUsdcAccount: authorUsdc,
        authorBondVaultAuthority: authorBondVaultAuth,
        authorBondVault: authorBondTokenVault,
        author: author.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([author])
      .rpc();

    const vouch = vouchPda(voucherProfile, authorProfile);
    const vouchVaultAuth = vouchVaultAuthority(voucherProfile, authorProfile);
    const vouchTokenVault = vouchVault(voucherProfile, authorProfile);
    await program.methods
      .vouch(new anchor.BN(3 * ONE_USDC))
      .accounts({
        vouch,
        voucherProfile,
        voucheeProfile: authorProfile,
        config,
        usdcMint,
        voucherUsdcAccount: voucherUsdc,
        vouchVaultAuthority: vouchVaultAuth,
        vouchVault: vouchTokenVault,
        voucher: voucher.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([voucher])
      .rpc();

    const skillId = `usdc-skill-${Date.now()}`;
    const skillListing = skillListingPda(skillId);
    const rewardVaultAuth = rewardVaultAuthority(skillListing);
    const rewardTokenVault = rewardVault(skillListing);
    await program.methods
      .createSkillListing(
        skillId,
        "ipfs://agentvouch-usdc-test",
        "USDC Test Skill",
        "Tests USDC-native protocol accounting",
        new anchor.BN(2 * ONE_USDC)
      )
      .accounts({
        skillListing,
        authorProfile,
        config,
        authorBond,
        usdcMint,
        rewardVaultAuthority: rewardVaultAuth,
        rewardVault: rewardTokenVault,
        author: author.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([author])
      .rpc();

    const position = listingVouchPosition(skillListing, vouch);
    await program.methods
      .linkVouchToListing()
      .accounts({
        skillListing,
        listingVouchPosition: position,
        vouch,
        voucherProfile,
        authorProfile,
        config,
        voucher: voucher.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([voucher])
      .rpc();

    const purchase = purchasePda(skillListing);
    const authorBalanceBefore = await getAccount(provider.connection, authorUsdc);
    await program.methods
      .purchaseSkill()
      .accounts({
        skillListing,
        purchase,
        author: author.publicKey,
        authorProfile,
        config,
        usdcMint,
        buyerUsdcAccount: buyerUsdc,
        authorUsdcAccount: authorUsdc,
        rewardVault: rewardTokenVault,
        buyer: buyer.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([buyer])
      .rpc();

    const authorBalanceAfter = await getAccount(provider.connection, authorUsdc);
    assert.equal(
      Number(authorBalanceAfter.amount - authorBalanceBefore.amount),
      1.2 * ONE_USDC
    );

    const voucherBalanceBefore = await getAccount(provider.connection, voucherUsdc);
    await program.methods
      .claimVoucherRevenue()
      .accounts({
        skillListing,
        listingVouchPosition: position,
        vouch,
        authorProfile,
        voucherProfile,
        config,
        usdcMint,
        rewardVaultAuthority: rewardVaultAuth,
        rewardVault: rewardTokenVault,
        voucherUsdcAccount: voucherUsdc,
        voucher: voucher.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([voucher])
      .rpc();

    const voucherBalanceAfter = await getAccount(provider.connection, voucherUsdc);
    assert.equal(
      Number(voucherBalanceAfter.amount - voucherBalanceBefore.amount),
      799_999
    );

    const disputeId = new anchor.BN(Date.now());
    const authorDispute = authorDisputePda(author.publicKey, disputeId);
    const disputeVaultAuth = disputeBondVaultAuthority(author.publicKey, disputeId);
    const disputeTokenVault = disputeBondVault(author.publicKey, disputeId);
    await program.methods
      .openAuthorDispute(
        disputeId,
        { failedDelivery: {} },
        "https://example.com/evidence.json"
      )
      .accounts({
        authorDispute,
        authorProfile,
        config,
        skillListing,
        purchase,
        usdcMint,
        challengerUsdcAccount: challengerUsdc,
        disputeBondVaultAuthority: disputeVaultAuth,
        disputeBondVault: disputeTokenVault,
        challenger: challenger.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([challenger])
      .rpc();

    const treasuryBeforeResolve = await getAccount(provider.connection, protocolTreasuryVault);
    await program.methods
      .resolveAuthorDispute(disputeId, { dismissed: {} })
      .accountsStrict({
        authorDispute,
        authorProfile,
        config,
        authority: configAdmin.publicKey,
        usdcMint,
        disputeBondVaultAuthority: disputeVaultAuth,
        disputeBondVault: disputeTokenVault,
        protocolTreasuryVault,
        authorBondVaultAuthority: authorBondVaultAuth,
        challenger: challenger.publicKey,
        challengerUsdcAccount: challengerUsdc,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([configAdmin])
      .rpc();

    const treasuryAfterResolve = await getAccount(provider.connection, protocolTreasuryVault);
    assert.equal(
      Number(treasuryAfterResolve.amount - treasuryBeforeResolve.amount),
      0.5 * ONE_USDC
    );
  });
});
