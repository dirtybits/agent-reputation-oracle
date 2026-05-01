import { AGENTVOUCH_PROGRAM_ID } from "@agentvouch/protocol";
import anchor from "@coral-xyz/anchor";
import {
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  type Commitment,
} from "@solana/web3.js";
import agentvouchIdl from "../../../../web/agentvouch.json";

const { AnchorProvider, Program, Wallet, web3 } = anchor;
const MIN_SKILL_PRICE_LAMPORTS = 1_000_000n;

function toPublicKey(value: PublicKey | string): PublicKey {
  return value instanceof PublicKey ? value : new PublicKey(value);
}

function toLamportsBigInt(
  value: number | bigint,
  fieldName: string
): bigint {
  if (typeof value === "bigint") {
    if (value < 0n) {
      throw new Error(`${fieldName} must be non-negative.`);
    }
    return value;
  }

  if (!Number.isFinite(value) || !Number.isInteger(value) || value < 0) {
    throw new Error(`${fieldName} must be a non-negative integer.`);
  }
  if (!Number.isSafeInteger(value)) {
    throw new Error(
      `${fieldName} exceeds JavaScript's safe integer range.`
    );
  }

  return BigInt(value);
}

function toLamportsBn(value: number | bigint, fieldName: string) {
  return new anchor.BN(toLamportsBigInt(value, fieldName).toString());
}

function toStakeLamports(amountSol: number): bigint {
  if (!Number.isFinite(amountSol) || amountSol <= 0) {
    throw new Error("amountSol must be a positive SOL amount.");
  }

  const lamports = amountSol * LAMPORTS_PER_SOL;
  if (!Number.isFinite(lamports) || !Number.isInteger(lamports)) {
    throw new Error(
      "amountSol must convert to a whole lamport amount."
    );
  }
  if (!Number.isSafeInteger(lamports)) {
    throw new Error(
      "amountSol exceeds JavaScript's safe integer range in lamports."
    );
  }

  return BigInt(lamports);
}

function assertSupportedListingPrice(priceLamports: bigint) {
  if (priceLamports !== 0n && priceLamports < MIN_SKILL_PRICE_LAMPORTS) {
    throw new Error(
      `priceLamports must be 0 or at least ${MIN_SKILL_PRICE_LAMPORTS.toString()} lamports.`
    );
  }
}

export class AgentVouchSolanaClient {
  readonly connection: web3.Connection;
  readonly provider: anchor.AnchorProvider;
  readonly program: anchor.Program<anchor.Idl>;

  constructor(
    private readonly keypair: Keypair,
    rpcUrl: string,
    commitment: Commitment = "confirmed"
  ) {
    this.connection = new web3.Connection(rpcUrl, commitment);
    this.provider = new AnchorProvider(this.connection, new Wallet(keypair), {
      commitment,
    });
    this.program = new Program(
      agentvouchIdl as anchor.Idl,
      this.provider
    );
  }

  get authority(): PublicKey {
    return this.keypair.publicKey;
  }

  getConfigAddress(): PublicKey {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("config")],
      new PublicKey(AGENTVOUCH_PROGRAM_ID)
    )[0];
  }

  getAgentProfileAddress(authority: PublicKey | string): PublicKey {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("agent"), toPublicKey(authority).toBuffer()],
      new PublicKey(AGENTVOUCH_PROGRAM_ID)
    )[0];
  }

  getAuthorBondAddress(authority: PublicKey | string): PublicKey {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("author_bond"), toPublicKey(authority).toBuffer()],
      new PublicKey(AGENTVOUCH_PROGRAM_ID)
    )[0];
  }

  getSkillListingAddress(
    skillId: string,
    author: PublicKey | string = this.authority
  ) {
    return PublicKey.findProgramAddressSync(
      [
        Buffer.from("skill"),
        toPublicKey(author).toBuffer(),
        Buffer.from(skillId),
      ],
      new PublicKey(AGENTVOUCH_PROGRAM_ID)
    )[0];
  }

  getPurchaseAddress(
    skillListing: PublicKey | string,
    buyer: PublicKey | string = this.authority
  ): PublicKey {
    return PublicKey.findProgramAddressSync(
      [
        Buffer.from("purchase"),
        toPublicKey(buyer).toBuffer(),
        toPublicKey(skillListing).toBuffer(),
      ],
      new PublicKey(AGENTVOUCH_PROGRAM_ID)
    )[0];
  }

  getVouchAddress(vouchee: PublicKey | string): PublicKey {
    const voucherProfile = this.getAgentProfileAddress(this.authority);
    const voucheeProfile = this.getAgentProfileAddress(vouchee);
    return PublicKey.findProgramAddressSync(
      [
        Buffer.from("vouch"),
        voucherProfile.toBuffer(),
        voucheeProfile.toBuffer(),
      ],
      new PublicKey(AGENTVOUCH_PROGRAM_ID)
    )[0];
  }

  async accountExists(address: PublicKey): Promise<boolean> {
    return (await this.connection.getAccountInfo(address)) !== null;
  }

  async registerAgent(metadataUri: string) {
    const agentProfile = this.getAgentProfileAddress(this.authority);
    if (await this.accountExists(agentProfile)) {
      return {
        tx: null as string | null,
        alreadyRegistered: true,
        agentProfile: agentProfile.toBase58(),
      };
    }

    const tx = await this.program.methods
      .registerAgent(metadataUri)
      .accounts({
        agentProfile,
        authority: this.authority,
        systemProgram: SystemProgram.programId,
      })
      .signers([this.keypair])
      .rpc();

    return {
      tx,
      alreadyRegistered: false,
      agentProfile: agentProfile.toBase58(),
    };
  }

  async vouch(vouchee: string, amountSol: number) {
    const voucherProfile = this.getAgentProfileAddress(this.authority);
    const voucheeProfile = this.getAgentProfileAddress(vouchee);
    const vouch = this.getVouchAddress(vouchee);
    const config = this.getConfigAddress();

    if (await this.accountExists(vouch)) {
      return {
        tx: null as string | null,
        alreadyExists: true,
        vouch: vouch.toBase58(),
      };
    }

    const lamports = toStakeLamports(amountSol);
    const tx = await this.program.methods
      .vouch(toLamportsBn(lamports, "stakeLamports"))
      .accounts({
        vouch,
        voucherProfile,
        voucheeProfile,
        config,
        voucher: this.authority,
        systemProgram: SystemProgram.programId,
      })
      .signers([this.keypair])
      .rpc();

    return {
      tx,
      alreadyExists: false,
      vouch: vouch.toBase58(),
      lamports: Number(lamports),
    };
  }

  async purchaseSkill(skillListingAddress: string, authorAddress: string) {
    const purchase = this.getPurchaseAddress(skillListingAddress);
    if (await this.accountExists(purchase)) {
      return {
        tx: null as string | null,
        alreadyPurchased: true,
        purchase: purchase.toBase58(),
      };
    }

    const authorProfile = this.getAgentProfileAddress(authorAddress);
    const tx = await this.program.methods
      .purchaseSkill()
      .accounts({
        skillListing: new PublicKey(skillListingAddress),
        purchase,
        author: new PublicKey(authorAddress),
        authorProfile,
        buyer: this.authority,
        systemProgram: SystemProgram.programId,
      })
      .signers([this.keypair])
      .rpc();

    return {
      tx,
      alreadyPurchased: false,
      purchase: purchase.toBase58(),
    };
  }

  async claimVoucherRevenue(skillListingAddress: string, authorAddress: string) {
    const voucherProfile = this.getAgentProfileAddress(this.authority);
    const authorProfile = this.getAgentProfileAddress(authorAddress);
    const vouch = this.getVouchAddress(authorAddress);

    const tx = await this.program.methods
      .claimVoucherRevenue()
      .accounts({
        skillListing: new PublicKey(skillListingAddress),
        vouch,
        voucherProfile,
        authorProfile,
        voucher: this.authority,
        systemProgram: SystemProgram.programId,
      })
      .signers([this.keypair])
      .rpc();

    return {
      tx,
      skillListing: skillListingAddress,
      vouch: vouch.toBase58(),
      voucherProfile: voucherProfile.toBase58(),
      authorProfile: authorProfile.toBase58(),
    };
  }

  async createSkillListing(input: {
    skillId: string;
    skillUri: string;
    name: string;
    description: string;
    priceLamports: number | bigint;
  }) {
    const priceLamports = toLamportsBigInt(input.priceLamports, "priceLamports");
    assertSupportedListingPrice(priceLamports);
    const skillListing = this.getSkillListingAddress(input.skillId);
    if (await this.accountExists(skillListing)) {
      return {
        tx: null as string | null,
        alreadyExists: true,
        skillListing: skillListing.toBase58(),
      };
    }

    const authorProfile = this.getAgentProfileAddress(this.authority);
    const config = this.getConfigAddress();
    const authorBond =
      priceLamports === 0n
        ? this.getAuthorBondAddress(this.authority)
        : null;

    const tx = await this.program.methods
      .createSkillListing(
        input.skillId,
        input.skillUri,
        input.name,
        input.description,
        toLamportsBn(priceLamports, "priceLamports")
      )
      .accounts({
        skillListing,
        authorProfile,
        config,
        authorBond,
        author: this.authority,
        systemProgram: SystemProgram.programId,
      })
      .signers([this.keypair])
      .rpc();

    return {
      tx,
      alreadyExists: false,
      skillListing: skillListing.toBase58(),
    };
  }
}
