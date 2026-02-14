import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { ReputationOracle } from "../target/types/reputation_oracle";
import { Connection, Keypair, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import * as fs from "fs";

async function main() {
  // Configuration
  const VOUCHEE_PUBKEY = "dmt4CBeNrF6iMV793zfJGiAAqVK9C9bifdL9cvqNTou";
  const STAKE_AMOUNT = 0.5 * LAMPORTS_PER_SOL; // 500000000 lamports
  const PROGRAM_ID = "ELmVnLSNuwNca4PfPqeqNowoUF8aDdtfto3rF9d89wf";
  const RPC_URL = "https://api.devnet.solana.com";
  
  console.log("🚀 Starting vouch transaction...\n");
  
  // Connect to devnet
  const connection = new Connection(RPC_URL, "confirmed");
  
  // Load voucher keypair (Sparky)
  const keypairPath = "/Users/andy/.openclaw/workspace/.agent-keys/sparky-keypair.json";
  const sparkyKeypairData = JSON.parse(fs.readFileSync(keypairPath, "utf-8"));
  const voucherKeypair = Keypair.fromSecretKey(new Uint8Array(sparkyKeypairData));
  
  console.log("📝 Voucher (Sparky):", voucherKeypair.publicKey.toString());
  console.log("📝 Vouchee:", VOUCHEE_PUBKEY);
  console.log("💰 Stake Amount:", STAKE_AMOUNT / LAMPORTS_PER_SOL, "SOL\n");
  
  // Check balance
  const balance = await connection.getBalance(voucherKeypair.publicKey);
  console.log("💵 Voucher Balance:", balance / LAMPORTS_PER_SOL, "SOL");
  
  if (balance < STAKE_AMOUNT + 0.01 * LAMPORTS_PER_SOL) {
    console.error("❌ Insufficient balance! Need at least", (STAKE_AMOUNT + 0.01 * LAMPORTS_PER_SOL) / LAMPORTS_PER_SOL, "SOL");
    process.exit(1);
  }
  
  // Load IDL
  const idlPath = "./target/idl/reputation_oracle.json";
  const idl = JSON.parse(fs.readFileSync(idlPath, "utf-8"));
  
  // Setup Anchor
  const wallet = new anchor.Wallet(voucherKeypair);
  const provider = new anchor.AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });
  const programId = new PublicKey(PROGRAM_ID);
  const program = new Program(idl, provider) as Program<ReputationOracle>;
  
  console.log("📍 Program ID:", program.programId.toString(), "\n");
  
  // Derive PDAs
  const voucheeAuthority = new PublicKey(VOUCHEE_PUBKEY);
  
  const [voucherProfile] = PublicKey.findProgramAddressSync(
    [Buffer.from("agent"), voucherKeypair.publicKey.toBuffer()],
    programId
  );
  
  const [voucheeProfile] = PublicKey.findProgramAddressSync(
    [Buffer.from("agent"), voucheeAuthority.toBuffer()],
    programId
  );
  
  const [config] = PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    programId
  );
  
  const [vouchPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("vouch"), voucherProfile.toBuffer(), voucheeProfile.toBuffer()],
    programId
  );
  
  console.log("🔑 Derived PDAs:");
  console.log("  Voucher Profile:", voucherProfile.toString());
  console.log("  Vouchee Profile:", voucheeProfile.toString());
  console.log("  Config:", config.toString());
  console.log("  Vouch:", vouchPda.toString(), "\n");
  
  // Check if voucher is registered
  try {
    const voucherProfileData = await program.account.agentProfile.fetch(voucherProfile);
    console.log("✅ Voucher is registered");
    console.log("   Reputation Score:", voucherProfileData.reputationScore.toString());
  } catch (error) {
    console.log("⚠️  Voucher not registered. Registering now...");
    try {
      const registerTx = await program.methods
        .registerAgent("https://sparky.openclaw.ai/metadata.json")
        .rpc();
      console.log("✅ Voucher registered!");
      console.log("   Transaction:", registerTx);
      console.log("   Explorer:", `https://explorer.solana.com/tx/${registerTx}?cluster=devnet\n`);
      
      // Wait for confirmation
      await connection.confirmTransaction(registerTx, "confirmed");
    } catch (regError: any) {
      console.error("❌ Failed to register voucher:", regError.message);
      if (regError.logs) console.error("Logs:", regError.logs);
      process.exit(1);
    }
  }
  
  // Check if vouchee is registered
  try {
    const voucheeProfileData = await program.account.agentProfile.fetch(voucheeProfile);
    console.log("✅ Vouchee is registered");
    console.log("   Reputation Score:", voucheeProfileData.reputationScore.toString(), "\n");
  } catch (error) {
    console.error("❌ Vouchee is not registered!");
    console.error("   The vouchee must register first before receiving vouches.");
    console.error("   Vouchee should run: anchor run register-agent");
    process.exit(1);
  }
  
  // Execute vouch
  console.log("📤 Sending vouch transaction...");
  try {
    // Since Anchor can't auto-resolve the vouchee_profile (it needs the authority from the account),
    // we need to pass it explicitly
    const tx = await program.methods
      .vouch(new anchor.BN(STAKE_AMOUNT))
      .accounts({
        voucheeProfile: voucheeProfile,
      } as any)
      .rpc();
    
    console.log("\n✅ Vouch transaction successful!");
    console.log("📝 Transaction Hash:", tx);
    console.log("🔍 Explorer:", `https://explorer.solana.com/tx/${tx}?cluster=devnet`);
    console.log("\n🎉 Successfully vouched for", VOUCHEE_PUBKEY);
    console.log("   with", STAKE_AMOUNT / LAMPORTS_PER_SOL, "SOL stake!");
    
  } catch (error: any) {
    console.error("\n❌ Vouch transaction failed!");
    console.error("Error:", error.message);
    if (error.logs) {
      console.error("\nProgram Logs:");
      error.logs.forEach((log: string) => console.error("  ", log));
    }
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
