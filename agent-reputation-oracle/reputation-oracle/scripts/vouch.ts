import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { ReputationOracle } from "../target/types/reputation_oracle";
import { PublicKey, Keypair } from "@solana/web3.js";
import fs from "fs";

async function main() {
  const voucherKeypairPath = process.argv[2];
  const voucheeAddress = process.argv[3];
  const amountSol = parseFloat(process.argv[4] || "0.05");

  if (!voucherKeypairPath || !voucheeAddress) {
    console.error("Usage: ts-node vouch.ts <voucher-keypair-path> <vouchee-address> [amount-sol]");
    process.exit(1);
  }

  const voucherKeypair = Keypair.fromSecretKey(
    new Uint8Array(JSON.parse(fs.readFileSync(voucherKeypairPath, "utf-8")))
  );
  const vouchee = new PublicKey(voucheeAddress);

  const provider = new anchor.AnchorProvider(
    new anchor.web3.Connection("https://api.devnet.solana.com", "confirmed"),
    new anchor.Wallet(voucherKeypair),
    { commitment: "confirmed" }
  );
  anchor.setProvider(provider);

  const program = anchor.workspace.ReputationOracle as Program<ReputationOracle>;

  console.log("Voucher:", voucherKeypair.publicKey.toBase58());
  console.log("Vouchee:", vouchee.toBase58());
  console.log("Amount:", amountSol, "SOL");

  const stakeAmount = new anchor.BN(amountSol * anchor.web3.LAMPORTS_PER_SOL);

  // Get PDAs
  const [voucherProfile] = PublicKey.findProgramAddressSync(
    [Buffer.from("agent"), voucherKeypair.publicKey.toBuffer()],
    program.programId
  );
  
  const [voucheeProfile] = PublicKey.findProgramAddressSync(
    [Buffer.from("agent"), vouchee.toBuffer()],
    program.programId
  );
  
  const [vouchPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("vouch"), voucherProfile.toBuffer(), voucheeProfile.toBuffer()],
    program.programId
  );
  
  const [configPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    program.programId
  );

  console.log("\nPDAs:");
  console.log("  Voucher Profile:", voucherProfile.toBase58());
  console.log("  Vouchee Profile:", voucheeProfile.toBase58());
  console.log("  Vouch PDA:", vouchPda.toBase58());
  console.log("  Config:", configPda.toBase58());

  try {
    const tx = await program.methods
      .vouch(stakeAmount)
      .rpc();

    console.log("\n✅ Vouch created!");
    console.log("Transaction:", tx);
    
    // Wait a moment and check updated profiles
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const [voucheeProfile] = PublicKey.findProgramAddressSync(
      [Buffer.from("agent"), vouchee.toBuffer()],
      program.programId
    );
    
    const profile = await program.account.agentProfile.fetch(voucheeProfile);
    console.log("\nVouchee updated stats:");
    console.log("  Reputation Score:", profile.reputationScore.toString());
    console.log("  Vouches Received:", profile.totalVouchesReceived);
    console.log("  Total Staked For:", (profile.totalStakedFor.toNumber() / anchor.web3.LAMPORTS_PER_SOL).toFixed(4), "SOL");
    
  } catch (e: any) {
    console.error("\n❌ Vouch failed:");
    console.error(e.message);
    if (e.logs) {
      console.log("\nLogs:");
      e.logs.forEach((log: string) => console.log("  ", log));
    }
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
