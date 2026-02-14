import * as fs from 'fs';
import * as path from 'path';
import { Program, AnchorProvider, web3, BN } from '@coral-xyz/anchor';
import { PublicKey, Connection, Keypair } from '@solana/web3.js';
import IDL from '../target/idl/reputation_oracle.json';

const PROGRAM_ID = new PublicKey('ELmVnLSNuwNca4PfPqeqNowoUF8aDdtfto3rF9d89wf');
const RPC_URL = 'https://api.devnet.solana.com';

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.error('Usage: vouch-agent <vouchee_address> <stake_sol>');
    console.error('Example: vouch-agent dmt4CBeNrF6iMV793zfJGiAAqVK9C9bifdL9cvqNTou 0.5');
    process.exit(1);
  }

  const voucheeAddress = new PublicKey(args[0]);
  const stakeSol = parseFloat(args[1]);
  const stakeAmount = stakeSol * web3.LAMPORTS_PER_SOL;

  console.log(`🔐 Vouch Transaction`);
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

  // Setup connection and provider
  const connection = new Connection(RPC_URL);
  const provider = new AnchorProvider(connection, { publicKey: vouchingAgent } as any, { commitment: 'confirmed' });
  const program = new Program(IDL as any, PROGRAM_ID, provider);

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

  // Execute vouch instruction
  try {
    console.log(`\n⏳ Sending vouch transaction...`);
    
    const tx = await program.methods
      .vouch(new BN(stakeAmount))
      .accounts({
        vouch: vouchPDA,
        voucherProfile: voucherProfilePDA,
        voucheeProfile: voucheeProfilePDA,
        config: configPDA,
        voucher: vouchingAgent,
        systemProgram: web3.SystemProgram.programId,
      })
      .signers([keypair])
      .rpc({ skipPreflight: false });

    console.log(`\n✅ Transaction Successful!`);
    console.log(`📊 Hash: ${tx}`);
    console.log(`🔗 https://explorer.solana.com/tx/${tx}?cluster=devnet`);
  } catch (error: any) {
    console.error(`\n❌ Transaction Failed:`);
    console.error(error.message);
    if (error.logs) {
      console.error('Logs:', error.logs);
    }
    process.exit(1);
  }
}

main().catch(console.error);
