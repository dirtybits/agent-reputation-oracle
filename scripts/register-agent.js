#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { PublicKey, Connection, Keypair, Transaction, SystemProgram, TransactionInstruction } = require('@solana/web3.js');

const PROGRAM_ID = new PublicKey('ELmVnLSNuwNca4PfPqeqNowoUF8aDdtfto3rF9d89wf');
const RPC_URL = 'https://api.devnet.solana.com';

async function main() {
  console.log(`📝 Register Agent`);

  // Load keypair
  const keypairPath = path.join(process.env.HOME || '/root', '.openclaw/workspace/.agent-keys/sparky-keypair.json');
  if (!fs.existsSync(keypairPath)) {
    throw new Error(`Keypair not found at ${keypairPath}`);
  }

  const keypairData = JSON.parse(fs.readFileSync(keypairPath, 'utf8'));
  const keypair = Keypair.fromSecretKey(Buffer.from(keypairData));
  const agentAddress = keypair.publicKey;

  console.log(`Agent Address: ${agentAddress.toBase58()}`);

  const connection = new Connection(RPC_URL);

  // Derive PDAs
  const [agentProfilePDA] = PublicKey.findProgramAddressSync(
    [Buffer.from('agent'), agentAddress.toBuffer()],
    PROGRAM_ID
  );

  console.log(`\n📋 Accounts:`);
  console.log(`  Agent Profile PDA: ${agentProfilePDA.toBase58()}`);

  try {
    // Check if already registered
    const profileAccount = await connection.getAccountInfo(agentProfilePDA);
    if (profileAccount) {
      console.log(`\n✅ Agent already registered!`);
      return;
    }

    // Build register_agent instruction discriminator from IDL
    const discriminator = Buffer.from([135, 157, 66, 195, 2, 113, 175, 30]);

    // Build instruction data: discriminator + metadata_uri string (4 bytes length + string)
    const metadataUri = "";
    const metadataUriBuffer = Buffer.alloc(4 + metadataUri.length);
    metadataUriBuffer.writeUInt32LE(metadataUri.length);
    metadataUriBuffer.write(metadataUri, 4);

    const instructionData = Buffer.concat([discriminator, metadataUriBuffer]);

    console.log(`\n📝 Instruction Data:`, instructionData.toString('hex'));

    // Build the register instruction
    const registerInstruction = new TransactionInstruction({
      programId: PROGRAM_ID,
      keys: [
        { pubkey: agentProfilePDA, isSigner: false, isWritable: true },
        { pubkey: agentAddress, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data: instructionData,
    });

    // Build and send transaction
    console.log(`\n⏳ Building transaction...`);
    const latestBlockhash = await connection.getLatestBlockhash();
    const transaction = new Transaction({
      recentBlockhash: latestBlockhash.blockhash,
      feePayer: agentAddress,
    });
    transaction.add(registerInstruction);

    console.log(`⏳ Signing transaction...`);
    transaction.sign(keypair);

    console.log(`⏳ Sending transaction...`);
    const txHash = await connection.sendRawTransaction(transaction.serialize());

    console.log(`\n✅ Transaction Submitted!`);
    console.log(`📊 Hash: ${txHash}`);
    console.log(`🔗 https://explorer.solana.com/tx/${txHash}?cluster=devnet`);

    // Wait for confirmation
    console.log(`⏳ Waiting for confirmation...`);
    await connection.confirmTransaction(txHash);
    console.log(`✅ Agent Registered!`);

  } catch (error) {
    console.error(`\n❌ Transaction Failed:`);
    console.error(error.message);
    if (error.logs) {
      console.error('Logs:', error.logs);
    }
    process.exit(1);
  }
}

main().catch(console.error);
