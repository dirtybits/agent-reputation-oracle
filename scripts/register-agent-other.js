#!/usr/bin/env node

const { PublicKey, Connection, Keypair, Transaction, SystemProgram, TransactionInstruction } = require('@solana/web3.js');

const PROGRAM_ID = new PublicKey('ELmVnLSNuwNca4PfPqeqNowoUF8aDdtfto3rF9d89wf');
const RPC_URL = 'https://api.devnet.solana.com';

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.error('Usage: register-agent-other <agent_address>');
    process.exit(1);
  }

  const agentAddress = new PublicKey(args[0]);
  console.log(`📝 Register Agent: ${agentAddress.toBase58()}`);

  const connection = new Connection(RPC_URL);

  // Derive agent profile PDA
  const [agentProfilePDA] = PublicKey.findProgramAddressSync(
    [Buffer.from('agent'), agentAddress.toBuffer()],
    PROGRAM_ID
  );

  console.log(`Agent Profile PDA: ${agentProfilePDA.toBase58()}`);

  try {
    // Check if already registered
    const profileAccount = await connection.getAccountInfo(agentProfilePDA);
    if (profileAccount) {
      console.log(`✅ Agent already registered!`);
      return;
    }

    console.log(`❌ Agent not registered. This agent needs to register themselves first using the web UI or their own agent script.`);
    console.log(`\nTo register via web: https://agentvouch.vercel.app/`);

  } catch (error) {
    console.error(`\n❌ Error:`);
    console.error(error.message);
    process.exit(1);
  }
}

main().catch(console.error);
