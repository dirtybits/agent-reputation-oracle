import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { Program, AnchorProvider, web3, BN } from '@coral-xyz/anchor';
import { PublicKey } from '@solana/web3.js';
import { useMemo } from 'react';
import IDL from '../reputation_oracle.json';

// Program ID with marketplace support (Feb 12, 2026 - v2)
const PROGRAM_ID = new PublicKey('ELmVnLSNuwNca4PfPqeqNowoUF8aDdtfto3rF9d89wf');
console.log('🚀 Reputation Oracle Hook v2 loaded - Program ID:', PROGRAM_ID.toBase58());

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

  const getSkillListingPDA = (authorKey: PublicKey, skillId: string) => {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('skill'), authorKey.toBuffer(), Buffer.from(skillId)],
      PROGRAM_ID
    )[0];
  };

  const getPurchasePDA = (buyerKey: PublicKey, skillListing: PublicKey) => {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('purchase'), buyerKey.toBuffer(), skillListing.toBuffer()],
      PROGRAM_ID
    )[0];
  };

  const registerAgent = async (metadataUri: string) => {
    if (!program || !wallet.publicKey) throw new Error('Wallet not connected');

    const agentProfile = getAgentPDA(wallet.publicKey);

    const tx = await program.methods
      .registerAgent(metadataUri)
      .rpc();

    return { tx, agentProfile };
  };

  const vouch = async (voucheeKey: PublicKey, amount: number) => {
    if (!program || !wallet.publicKey) throw new Error('Wallet not connected');

    const voucherProfile = getAgentPDA(wallet.publicKey);
    const voucheeProfile = getAgentPDA(voucheeKey);
    const vouchAccount = getVouchPDA(voucherProfile, voucheeProfile);
    const config = getConfigPDA();

    const tx = await program.methods
      .vouch(new BN(amount * web3.LAMPORTS_PER_SOL))
      .accounts({
        voucher: wallet.publicKey,
        voucherProfile,
        voucheeProfile,
        config,
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
    const vouchAccount = getVouchPDA(voucherProfile, voucheeProfile);

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
      const account = await (program.account as any).agentProfile.fetch(agentProfile);
      return account;
    } catch {
      return null;
    }
  };

  const getVouch = async (voucher: PublicKey, vouchee: PublicKey) => {
    if (!program) return null;
    
    const vouchAccount = getVouchPDA(voucher, vouchee);
    try {
      const account = await (program.account as any).vouch.fetch(vouchAccount);
      return account;
    } catch {
      return null;
    }
  };

  const getAllVouchesForAgent = async (agentKey: PublicKey) => {
    if (!program) return [];
    
    try {
      const vouches = await (program.account as any).vouch.all([
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

  const getAllAgents = async () => {
    if (!program) return [];
    
    try {
      const agents = await (program.account as any).agentProfile.all();
      return agents;
    } catch (error) {
      console.error('Error fetching all agents:', error);
      return [];
    }
  };

  const getAllSkillListings = async () => {
    if (!program) return [];
    
    try {
      const skills = await (program.account as any).skillListing.all();
      return skills;
    } catch (error) {
      console.error('Error fetching skill listings:', error);
      return [];
    }
  };

  const getSkillListing = async (skillListingKey: PublicKey) => {
    if (!program) return null;
    
    try {
      const listing = await (program.account as any).skillListing.fetch(skillListingKey);
      return listing;
    } catch {
      return null;
    }
  };

  const createSkillListing = async (
    skillId: string,
    skillUri: string,
    name: string,
    description: string,
    priceLamports: number
  ) => {
    if (!program || !wallet.publicKey) throw new Error('Wallet not connected');

    const authorProfile = getAgentPDA(wallet.publicKey);
    const skillListing = getSkillListingPDA(wallet.publicKey, skillId);

    const tx = await program.methods
      .createSkillListing(skillId, skillUri, name, description, new BN(priceLamports))
      .accounts({
        skillListing,
        authorProfile,
        author: wallet.publicKey,
        systemProgram: web3.SystemProgram.programId,
      })
      .rpc();

    return { tx, skillListing };
  };

  const purchaseSkill = async (skillListingKey: PublicKey, authorKey: PublicKey) => {
    if (!program || !wallet.publicKey) throw new Error('Wallet not connected');

    const authorProfile = getAgentPDA(authorKey);
    const purchase = getPurchasePDA(wallet.publicKey, skillListingKey);

    const tx = await program.methods
      .purchaseSkill()
      .accounts({
        skillListing: skillListingKey,
        purchase,
        author: authorKey,
        authorProfile,
        buyer: wallet.publicKey,
        systemProgram: web3.SystemProgram.programId,
      })
      .rpc();

    return { tx, purchase };
  };

  const getMyPurchases = async () => {
    if (!program || !wallet.publicKey) return [];
    
    try {
      const purchases = await (program.account as any).purchase.all([
        {
          memcmp: {
            offset: 8, // After discriminator
            bytes: wallet.publicKey.toBase58(),
          },
        },
      ]);
      return purchases;
    } catch (error) {
      console.error('Error fetching purchases:', error);
      return [];
    }
  };

  const getMyListings = async () => {
    if (!program || !wallet.publicKey) return [];
    
    try {
      const authorProfile = getAgentPDA(wallet.publicKey);
      const listings = await (program.account as any).skillListing.all([
        {
          memcmp: {
            offset: 8 + 32, // After discriminator + author pubkey
            bytes: authorProfile.toBase58(),
          },
        },
      ]);
      return listings;
    } catch (error) {
      console.error('Error fetching my listings:', error);
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
    getAllAgents,
    getAllSkillListings,
    getSkillListing,
    createSkillListing,
    purchaseSkill,
    getMyPurchases,
    getMyListings,
    getAgentPDA,
    getVouchPDA,
    getDisputePDA,
    getConfigPDA,
    getSkillListingPDA,
    getPurchasePDA,
  };
}
