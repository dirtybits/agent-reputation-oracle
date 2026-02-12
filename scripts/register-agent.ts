import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { ReputationOracle } from "../target/types/reputation_oracle";
import { PublicKey, Keypair } from "@solana/web3.js";
import fs from "fs";

async function main() {
  const walletPath = process.argv[2];
  const metadataUri = process.argv[3] || "";

  if (!walletPath) {
    console.error("Usage: ts-node register-agent.ts <keypair-path> [metadata-uri]");
    process.exit(1);
  }

  const keypairData = JSON.parse(fs.readFileSync(walletPath, "utf-8"));
  const keypair = Keypair.fromSecretKey(new Uint8Array(keypairData));

  const provider = new anchor.AnchorProvider(
    new anchor.web3.Connection("https://api.devnet.solana.com", "confirmed"),
    new anchor.Wallet(keypair),
    { commitment: "confirmed" }
  );
  anchor.setProvider(provider);

  const program = anchor.workspace.ReputationOracle as Program<ReputationOracle>;

  console.log("Program ID:", program.programId.toBase58());
  console.log("Agent:", keypair.publicKey.toBase58());
  console.log("Metadata URI:", metadataUri || "(empty)");

  try {
    const tx = await program.methods
      .registerAgent(metadataUri)
      .rpc();

    console.log("\n✅ Agent registered!");
    console.log("Transaction:", tx);
  } catch (e: any) {
    console.error("\n❌ Registration failed:");
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
