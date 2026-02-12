import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { ReputationOracle } from "../target/types/reputation_oracle";
import * as fs from "fs";
import { PublicKey } from "@solana/web3.js";

async function main() {
  const connection = new anchor.web3.Connection("https://api.devnet.solana.com", "confirmed");
  
  const idl = JSON.parse(
    fs.readFileSync("./target/idl/reputation_oracle.json", "utf-8")
  );
  
  const programId = new PublicKey(idl.address);
  
  // Dummy wallet for reading (not needed for fetching, but Provider requires it)
  const dummyKeypair = anchor.web3.Keypair.generate();
  const dummyWallet = new anchor.Wallet(dummyKeypair);
  const provider = new anchor.AnchorProvider(connection, dummyWallet, {
    commitment: "confirmed",
  });
  
  const program = new Program(idl, provider) as Program<ReputationOracle>;
  
  const sparkyKey = new PublicKey("DRu2fqNcrieKtaAox2cFQSers1HJTyPj5ggv8nsryZxJ");
  const [agentPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("agent"), sparkyKey.toBuffer()],
    programId
  );
  
  console.log("Sparky's address:", sparkyKey.toString());
  console.log("Expected PDA:", agentPda.toString());
  
  try {
    const profile = await program.account.agentProfile.fetch(agentPda);
    console.log("\n✅ Sparky's profile found!");
    console.log("Metadata URI:", profile.metadataUri);
    console.log("Reputation Score:", profile.reputationScore.toString());
    console.log("Total Staked For:", profile.totalStakedFor.toString());
    console.log("Vouches Received:", profile.totalVouchesReceived);
    console.log("Vouches Given:", profile.totalVouchesGiven);
    console.log("Registered At:", new Date(profile.registeredAt.toNumber() * 1000).toISOString());
  } catch (error: any) {
    console.error("\n❌ Error fetching profile:", error.message);
  }
}

main().catch(console.error);
