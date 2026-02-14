#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { PublicKey, Connection, Keypair, Transaction, SystemProgram, TransactionInstruction } = require('@solana/web3.js');
const { BN } = require('@coral-xyz/anchor');

const PROGRAM_ID = new PublicKey('ELmVnLSNuwNca4PfPqeqNowoUF8aDdtfto3rF9d89wf');
const RPC_URL = 'https://api.devnet.solana.com';

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.error('Usage: vouch-raw <vouchee_address> <stake_sol>');
    console.error('Example: vouch-raw dmt4CBeNrF6iMV793zfJGiAAqVK9C9bifdL9cvqNTou 0.5');
    process.exit(1);
  }

  const voucheeAddress = new PublicKey(args[0]);
  const stakeSol = parseFloat(args[1]);
  const stakeAmount = Math.floor(stakeSol * 1e9); // Convert to lamports

  console.log(`🔐 Vouch Transaction (Raw)`);
  console.log(`Vouchee: ${voucheeAddress.toBase58()}`);
  console.log(`Stake: ${stakeSol} SOL (${stakeAmount} lamports)`);

  // Load keypair
  const keypairPath = path.join(process.env.HOME || '/root', '.openclaw/workspace/.agent-keys/sparky-keypair.json');
  if (!fs.existsSync(keypairPath)) {
    throw new Error(`Keypair not found at ${keypairPath}`);
  }

  const keypairData = JSON.parse(fs.readFileSync(keypairPath, 'utf8'));
  const keypair = Keypair.fromSecretKey(Buffer.from(keypairData));
  const vouchingAgent = keypair.publicKey;

  console.log(`Voucher: ${vouchingAgent.toBase58()}`);

  const connection = new Connection(RPC_URL);

  // Derive PDAs
  const [voucherProfilePDA] = PublicKey.findProgramAddressSync(
    [Buffer.from('agent'), vouchingAgent.toBuffer()],
    PROGRAM_ID
  );

  const [voucheeProfilePDA] = PublicKey.findProgramAddressSync(
    [Buffer.from('agent'), voucheeAddress.toBuffer()],
    PROGRAM_ID
  );

  const [vouchPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from('vouch'), voucherProfilePDA.toBuffer(), voucheeProfilePDA.toBuffer()],
    PROGRAM_ID
  );

  const [configPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from('config')],
    PROGRAM_ID
  );

  console.log(`\n📋 Accounts:`);
  console.log(`  Voucher Profile: ${voucherProfilePDA.toBase58()}`);
  console.log(`  Vouchee Profile: ${voucheeProfilePDA.toBase58()}`);
  console.log(`  Vouch Account: ${vouchPDA.toBase58()}`);
  console.log(`  Config: ${configPDA.toBase58()}`);

  try {
    // Build vouch instruction discriminator from IDL
    const discriminator = Buffer.from([87, 240, 8, 21, 219, 179, 242, 177]);

    // Build instruction data: discriminator + stake_amount (u64)
    const stakeAmountBuffer = Buffer.alloc(8);
    stakeAmountBuffer.writeBigUInt64LE(BigInt(stakeAmount));
    const instructionData = Buffer.concat([discriminator, stakeAmountBuffer]);

    console.log(`\n📝 Instruction Data:`, instructionData.toString('hex'));

    // Build the vouch instruction
    const vouchInstruction = new TransactionInstruction({
      programId: PROGRAM_ID,
      keys: [
        { pubkey: vouchPDA, isSigner: false, isWritable: true },
        { pubkey: voucherProfilePDA, isSigner: false, isWritable: true },
        { pubkey: voucheeProfilePDA, isSigner: false, isWritable: true },
        { pubkey: configPDA, isSigner: false, isWritable: false },
        { pubkey: vouchingAgent, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data: instructionData,
    });

    // Build and send transaction
    console.log(`\n⏳ Building transaction...`);
    const latestBlockhash = await connection.getLatestBlockhash();
    const transaction = new Transaction({
      recentBlockhash: latestBlockhash.blockhash,
      feePayer: vouchingAgent,
    });
    transaction.add(vouchInstruction);

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
    console.log(`✅ Confirmed!`);

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
