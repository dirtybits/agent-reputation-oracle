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
  
  const dummyKeypair = anchor.web3.Keypair.generate();
  const dummyWallet = new anchor.Wallet(dummyKeypair);
  const provider = new anchor.AnchorProvider(connection, dummyWallet, {
    commitment: "confirmed",
  });
  
  const program = new Program(idl, provider) as Program<ReputationOracle>;
  
  const agents = [
    { name: "Oddbox", address: "dmt4CBeNrF6iMV793zfJGiAAqVK9C9bifdL9cvqNTou" },
    { name: "Sparky", address: "DRu2fqNcrieKtaAox2cFQSers1HJTyPj5ggv8nsryZxJ" },
  ];
  
  for (const agent of agents) {
    const agentKey = new PublicKey(agent.address);
    const [agentPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("agent"), agentKey.toBuffer()],
      programId
    );
    
    console.log(`\n=== ${agent.name} ===`);
    console.log("Wallet:", agentKey.toString());
    console.log("Profile PDA:", agentPda.toString());
    
    try {
      const profile = await program.account.agentProfile.fetch(agentPda);
      console.log("✅ Profile found!");
      console.log("  Authority:", profile.authority.toString());
      console.log("  Reputation:", profile.reputationScore.toString());
      console.log("  Vouches Received:", profile.totalVouchesReceived);
      console.log("  Total Staked:", profile.totalStakedFor.toString());
    } catch (error: any) {
      console.log("❌ Error:", error.message);
    }
  }
}

main().catch(console.error);
