import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { ReputationOracle } from "../target/types/reputation_oracle";
import * as fs from "fs";
import { Keypair } from "@solana/web3.js";

async function main() {
  const connection = new anchor.web3.Connection("https://api.devnet.solana.com", "confirmed");
  
  // Load Sparky's keypair
  const sparkyKeypairData = JSON.parse(
    fs.readFileSync("/Users/andy/.openclaw/workspace/.agent-keys/sparky-keypair.json", "utf-8")
  );
  const sparkyKeypair = Keypair.fromSecretKey(new Uint8Array(sparkyKeypairData));
  
  console.log("Sparky's address:", sparkyKeypair.publicKey.toString());
  
  const wallet = new anchor.Wallet(sparkyKeypair);
  const provider = new anchor.AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });
  
  const idl = JSON.parse(
    fs.readFileSync("./target/idl/reputation_oracle.json", "utf-8")
  );
  
  const program = new Program(idl, provider) as Program<ReputationOracle>;
  
  console.log("Program ID:", program.programId.toString());
  
  // Register Sparky
  const metadataUri = "https://sparky.openclaw.ai/metadata.json";
  
  try {
    const tx = await program.methods
      .registerAgent(metadataUri)
      .rpc();
    
    console.log("✅ Sparky registered!");
    console.log("Transaction:", tx);
    
    // Derive and log the agent profile PDA
    const [agentProfile] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("agent"), sparkyKeypair.publicKey.toBuffer()],
      program.programId
    );
    console.log("Agent Profile PDA:", agentProfile.toString());
  } catch (error: any) {
    console.error("Error:", error);
    if (error.logs) {
      console.error("Logs:", error.logs);
    }
  }
}

main().catch(console.error);
