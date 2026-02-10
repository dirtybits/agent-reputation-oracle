import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { Program, AnchorProvider, web3, BN } from '@coral-xyz/anchor';
import { PublicKey } from '@solana/web3.js';
import { useMemo } from 'react';
import IDL from '../reputation_oracle.json';

// Program ID from Day 1 deployment
const PROGRAM_ID = new PublicKey('EDtweyEKbbesS4YbumnbdQeNr3aqdvUF9Df4g9wuuVoj');

export function useReputationOracle() {
  const { connection } = useConnection();
  const wallet = useWallet();

  const provider = useMemo(() => {
    if (!wallet.publicKey) return null;
    
    return new AnchorProvider(
      connection,
      wallet as any,
      { commitment: 'confirmed' }
    );
  }, [connection, wallet]);

  const program = useMemo(() => {
    if (!provider) return null;
    return new Program(IDL as any, provider);
  }, [provider]);

  const getAgentPDA = (agentKey: PublicKey) => {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('agent'), agentKey.toBuffer()],
      PROGRAM_ID
    )[0];
  };

  const getVouchPDA = (voucher: PublicKey, vouchee: PublicKey) => {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('vouch'), voucher.toBuffer(), vouchee.toBuffer()],
      PROGRAM_ID
    )[0];
  };

  const getDisputePDA = (vouchAccount: PublicKey) => {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('dispute'), vouchAccount.toBuffer()],
      PROGRAM_ID
    )[0];
  };

  const getConfigPDA = () => {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('config')],
      PROGRAM_ID
    )[0];
  };

  const registerAgent = async (metadataUri: string) => {
    if (!program || !wallet.publicKey) throw new Error('Wallet not connected');

    const agentProfile = getAgentPDA(wallet.publicKey);

    const tx = await program.methods
      .registerAgent(metadataUri)
      .accounts({
        agent: wallet.publicKey,
        agentProfile,
        systemProgram: web3.SystemProgram.programId,
      })
      .rpc();

    return { tx, agentProfile };
  };

  const vouch = async (voucheeKey: PublicKey, amount: number) => {
    if (!program || !wallet.publicKey) throw new Error('Wallet not connected');

    const voucherProfile = getAgentPDA(wallet.publicKey);
    const voucheeProfile = getAgentPDA(voucheeKey);
    const vouchAccount = getVouchPDA(wallet.publicKey, voucheeKey);

    const tx = await program.methods
      .vouch(new BN(amount * web3.LAMPORTS_PER_SOL))
      .accounts({
        voucher: wallet.publicKey,
        vouchee: voucheeKey,
        voucherProfile,
        voucheeProfile,
        vouch: vouchAccount,
        systemProgram: web3.SystemProgram.programId,
      })
      .rpc();

    return { tx, vouchAccount };
  };

  const revokeVouch = async (voucheeKey: PublicKey) => {
    if (!program || !wallet.publicKey) throw new Error('Wallet not connected');

    const voucherProfile = getAgentPDA(wallet.publicKey);
    const voucheeProfile = getAgentPDA(voucheeKey);
    const vouchAccount = getVouchPDA(wallet.publicKey, voucheeKey);

    const tx = await program.methods
      .revokeVouch()
      .accounts({
        voucher: wallet.publicKey,
        vouchee: voucheeKey,
        voucherProfile,
        voucheeProfile,
        vouch: vouchAccount,
      })
      .rpc();

    return { tx };
  };

  const openDispute = async (vouchAccount: PublicKey, evidence: string) => {
    if (!program || !wallet.publicKey) throw new Error('Wallet not connected');

    const config = getConfigPDA();
    const disputeAccount = getDisputePDA(vouchAccount);

    const tx = await program.methods
      .openDispute(evidence)
      .accounts({
        challenger: wallet.publicKey,
        vouch: vouchAccount,
        dispute: disputeAccount,
        config,
        systemProgram: web3.SystemProgram.programId,
      })
      .rpc();

    return { tx, disputeAccount };
  };

  const getAgentProfile = async (agentKey: PublicKey) => {
    if (!program) return null;
    
    const agentProfile = getAgentPDA(agentKey);
    try {
      const account = await program.account.agentProfile.fetch(agentProfile);
      return account;
    } catch {
      return null;
    }
  };

  const getVouch = async (voucher: PublicKey, vouchee: PublicKey) => {
    if (!program) return null;
    
    const vouchAccount = getVouchPDA(voucher, vouchee);
    try {
      const account = await program.account.vouch.fetch(vouchAccount);
      return account;
    } catch {
      return null;
    }
  };

  const getAllVouchesForAgent = async (agentKey: PublicKey) => {
    if (!program) return [];
    
    try {
      const vouches = await program.account.vouch.all([
        {
          memcmp: {
            offset: 8, // Discriminator
            bytes: agentKey.toBase58(),
          },
        },
      ]);
      return vouches;
    } catch {
      return [];
    }
  };

  return {
    program,
    provider,
    registerAgent,
    vouch,
    revokeVouch,
    openDispute,
    getAgentProfile,
    getVouch,
    getAllVouchesForAgent,
    getAgentPDA,
    getVouchPDA,
    getDisputePDA,
    getConfigPDA,
  };
}
