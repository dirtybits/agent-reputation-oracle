import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { ReputationOracle } from "../target/types/reputation_oracle";

async function main() {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.ReputationOracle as Program<ReputationOracle>;

  const [configPda] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    program.programId
  );

  console.log("Program ID:", program.programId.toBase58());
  console.log("Config PDA:", configPda.toBase58());

  try {
    // Check if already initialized
    const config = await program.account.reputationConfig.fetch(configPda);
    console.log("Config already initialized!");
    console.log("Min stake:", config.minStake.toNumber(), "lamports");
    console.log("Dispute bond:", config.disputeBond.toNumber(), "lamports");
    console.log("Slash percentage:", config.slashPercentage, "%");
    return;
  } catch (e) {
    console.log("Config not initialized, creating...");
  }

  // Initialize with reasonable defaults
  const minStake = new anchor.BN(0.01 * anchor.web3.LAMPORTS_PER_SOL); // 0.01 SOL minimum
  const disputeBond = new anchor.BN(0.05 * anchor.web3.LAMPORTS_PER_SOL); // 0.05 SOL bond
  const slashPercentage = 50; // 50% slashing
  const cooldownPeriod = new anchor.BN(60 * 60 * 24); // 1 day cooldown

  const tx = await program.methods
    .initializeConfig(minStake, disputeBond, slashPercentage, cooldownPeriod)
    .rpc();

  console.log("✅ Config initialized!");
  console.log("Transaction:", tx);
  console.log("Min stake:", minStake.toNumber() / anchor.web3.LAMPORTS_PER_SOL, "SOL");
  console.log("Dispute bond:", disputeBond.toNumber() / anchor.web3.LAMPORTS_PER_SOL, "SOL");
  console.log("Slash percentage:", slashPercentage, "%");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  });
