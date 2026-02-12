import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { ReputationOracle } from "../target/types/reputation_oracle";
import { PublicKey } from "@solana/web3.js";

async function main() {
  const provider = new anchor.AnchorProvider(
    new anchor.web3.Connection("https://api.devnet.solana.com", "confirmed"),
    new anchor.Wallet(anchor.web3.Keypair.generate()),
    { commitment: "confirmed" }
  );
  anchor.setProvider(provider);

  const program = anchor.workspace.ReputationOracle as Program<ReputationOracle>;

  const agentAddress = new PublicKey(process.argv[2] || "dmt4CBeNrF6iMV793zfJGiAAqVK9C9bifdL9cvqNTou");
  
  const [agentProfilePda] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("agent"), agentAddress.toBuffer()],
    program.programId
  );

  console.log("Checking agent:", agentAddress.toBase58());
  console.log("Profile PDA:", agentProfilePda.toBase58());

  try {
    const profile = await program.account.agentProfile.fetch(agentProfilePda);
    console.log("\n✅ Agent registered!");
    console.log("Reputation Score:", profile.reputationScore.toString());
    console.log("Vouches Received:", profile.totalVouchesReceived.toString());
    console.log("Vouches Given:", profile.totalVouchesGiven.toString());
    console.log("Total Staked For:", (profile.totalStakedFor.toNumber() / 1e9).toFixed(4), "SOL");
    console.log("Metadata URI:", profile.metadataUri);
    console.log("Registered At:", new Date(profile.registeredAt.toNumber() * 1000).toLocaleString());
  } catch (e: any) {
    console.log("\n❌ Agent not registered yet");
    console.log("Error:", e.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
