import { useWalletConnection, useSendTransaction } from '@solana/react-hooks';
import { useMemo, useCallback } from 'react';
import {
  address,
  createSolanaRpc,
  getAddressEncoder,
  getProgramDerivedAddress,
  getUtf8Encoder,
  isAddress,
  type Address,
  type TransactionSigner,
} from '@solana/kit';
import { createWalletTransactionSigner } from '@solana/client';
import type { Base64EncodedBytes, Base58EncodedBytes } from '@solana/rpc-types';

const asBase64 = (bytes: Uint8Array) =>
  Buffer.from(bytes).toString('base64') as Base64EncodedBytes;
const asBase58 = (addr: string) => addr as unknown as Base58EncodedBytes;
import {
  fetchMaybeAgentProfile,
  getAgentProfileDecoder,
  getRegisterAgentInstructionAsync,
  getVouchInstructionAsync,
  getRevokeVouchInstructionAsync,
  getOpenDisputeInstructionAsync,
  getCreateSkillListingInstructionAsync,
  getUpdateSkillListingInstructionAsync,
  getPurchaseSkillInstructionAsync,
  getSkillListingDecoder,
  getVouchDecoder,
  getPurchaseDecoder,
  AGENT_PROFILE_DISCRIMINATOR,
  SKILL_LISTING_DISCRIMINATOR,
  VOUCH_DISCRIMINATOR,
  PURCHASE_DISCRIMINATOR,
  type AgentProfile,
  type SkillListing,
  type Vouch as VouchAccount,
  type Purchase,
} from '../generated/reputation-oracle/src/generated';
import { REPUTATION_ORACLE_PROGRAM_ADDRESS } from '../generated/reputation-oracle/src/generated/programs';

const LAMPORTS_PER_SOL = 1_000_000_000n;
const ENDPOINT = process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? 'https://api.devnet.solana.com';
const rpc = createSolanaRpc(ENDPOINT);

const textEncoder = getUtf8Encoder();
const addressEncoder = getAddressEncoder();

async function deriveAddress(seeds: (string | Address)[], programId: Address = REPUTATION_ORACLE_PROGRAM_ADDRESS): Promise<Address> {
  const encodedSeeds = seeds.map((s) =>
    isAddress(s)
      ? addressEncoder.encode(s)
      : textEncoder.encode(s),
  );
  const [derived] = await getProgramDerivedAddress({ programAddress: programId, seeds: encodedSeeds });
  return derived;
}

async function getAgentPDA(agentKey: Address): Promise<Address> {
  return deriveAddress(['agent', agentKey]);
}

async function getVouchPDA(voucherProfile: Address, voucheeProfile: Address): Promise<Address> {
  return deriveAddress(['vouch', voucherProfile, voucheeProfile]);
}

async function getConfigPDA(): Promise<Address> {
  return deriveAddress(['config']);
}

async function getSkillListingPDA(author: Address, skillId: string): Promise<Address> {
  const encodedSeeds = [
    textEncoder.encode('skill'),
    addressEncoder.encode(author),
    textEncoder.encode(skillId),
  ];
  const [derived] = await getProgramDerivedAddress({ programAddress: REPUTATION_ORACLE_PROGRAM_ADDRESS, seeds: encodedSeeds });
  return derived;
}

async function getPurchasePDA(buyer: Address, skillListing: Address): Promise<Address> {
  return deriveAddress(['purchase', buyer, skillListing]);
}

export function useReputationOracle() {
  const { wallet, status } = useWalletConnection();
  const connected = status === 'connected' && wallet;
  const { send: frameworkSend } = useSendTransaction();

  const walletAddress: Address | null = connected ? wallet.account.address as Address : null;

  const signer: TransactionSigner | null = useMemo(() => {
    if (!connected || !wallet) return null;
    return createWalletTransactionSigner(wallet).signer;
  }, [connected, wallet]);

  const sendIx = useCallback(async (ix: any) => {
    if (!walletAddress || !wallet) throw new Error('Wallet not connected');
    const addressOnlyIx = {
      programAddress: ix.programAddress,
      data: ix.data,
      accounts: ix.accounts.map((acc: { address: Address; role: number }) => ({
        address: acc.address,
        role: acc.role,
      })),
    };
    try {
      const sig = await frameworkSend(
        {
          instructions: [addressOnlyIx],
          authority: wallet,
        },
        { skipPreflight: true },
      );
      return String(sig);
    } catch (err: any) {
      const cause = err?.cause ?? err;
      const logs = cause?.logs ?? cause?.context?.logs;
      if (logs?.length) console.error('Simulation logs:', logs);
      if (cause) {
        console.error('Transaction failed (cause):', cause);
        throw cause;
      }
      throw err;
    }
  }, [walletAddress, wallet, frameworkSend]);

  const registerAgent = useCallback(async (metadataUri: string) => {
    if (!signer || !walletAddress) throw new Error('Wallet not connected');
    const ix = await getRegisterAgentInstructionAsync({
      authority: signer,
      metadataUri,
    });
    const tx = await sendIx(ix);
    const agentProfile = await getAgentPDA(walletAddress);
    return { tx, agentProfile };
  }, [signer, walletAddress, sendIx]);

  const vouch = useCallback(async (voucheeKey: Address, amount: number) => {
    if (!signer || !walletAddress) throw new Error('Wallet not connected');
    const voucheeProfile = await getAgentPDA(voucheeKey);
    const ix = await getVouchInstructionAsync({
      voucheeProfile,
      voucher: signer,
      stakeAmount: BigInt(Math.round(amount * Number(LAMPORTS_PER_SOL))),
    });
    return { tx: await sendIx(ix) };
  }, [signer, walletAddress, sendIx]);

  const revokeVouch = useCallback(async (voucheeKey: Address) => {
    if (!signer || !walletAddress) throw new Error('Wallet not connected');
    const voucheeProfile = await getAgentPDA(voucheeKey);
    const ix = await getRevokeVouchInstructionAsync({
      voucheeProfile,
      voucher: signer,
    });
    return { tx: await sendIx(ix) };
  }, [signer, walletAddress, sendIx]);

  const openDispute = useCallback(async (vouchAccount: Address, evidence: string) => {
    if (!signer || !walletAddress) throw new Error('Wallet not connected');
    const ix = await getOpenDisputeInstructionAsync({
      vouch: vouchAccount,
      challenger: signer,
      evidenceUri: evidence,
    });
    return { tx: await sendIx(ix) };
  }, [signer, walletAddress, sendIx]);

  const getAgentProfile = useCallback(async (agentKey: Address) => {
    const pda = await getAgentPDA(agentKey);
    try {
      const account = await fetchMaybeAgentProfile(rpc, pda);
      if (!account.exists) return null;
      return account.data;
    } catch {
      return null;
    }
  }, []);

  const getAllAgents = useCallback(async () => {
    try {
      const accounts = await rpc.getProgramAccounts(REPUTATION_ORACLE_PROGRAM_ADDRESS, {
        encoding: 'base64',
        filters: [{ memcmp: { offset: 0n, bytes: asBase64(AGENT_PROFILE_DISCRIMINATOR), encoding: 'base64' } }],
      }).send();
      const decoder = getAgentProfileDecoder();
      return accounts.map((a) => ({
        publicKey: a.pubkey,
        account: decoder.decode(new Uint8Array(Buffer.from(a.account.data[0], 'base64'))),
      }));
    } catch (e) {
      console.error('Error fetching all agents:', e);
      return [];
    }
  }, []);

  const getAllVouchesForAgent = useCallback(async (agentKey: Address) => {
    try {
      const accounts = await rpc.getProgramAccounts(REPUTATION_ORACLE_PROGRAM_ADDRESS, {
        encoding: 'base64',
        filters: [
          { memcmp: { offset: 0n, bytes: asBase64(VOUCH_DISCRIMINATOR), encoding: 'base64' } },
          { memcmp: { offset: 8n, bytes: asBase58(agentKey), encoding: 'base58' } },
        ],
      }).send();
      const decoder = getVouchDecoder();
      return accounts.map((a) => ({
        publicKey: a.pubkey,
        account: decoder.decode(new Uint8Array(Buffer.from(a.account.data[0], 'base64'))),
      }));
    } catch {
      return [];
    }
  }, []);

  const getAllVouchesReceivedByAgent = useCallback(async (agentKey: Address) => {
    try {
      const accounts = await rpc.getProgramAccounts(REPUTATION_ORACLE_PROGRAM_ADDRESS, {
        encoding: 'base64',
        filters: [
          { memcmp: { offset: 0n, bytes: asBase64(VOUCH_DISCRIMINATOR), encoding: 'base64' } },
          { memcmp: { offset: 40n, bytes: asBase58(agentKey), encoding: 'base58' } },
        ],
      }).send();
      const decoder = getVouchDecoder();
      return accounts.map((a) => ({
        publicKey: a.pubkey,
        account: decoder.decode(new Uint8Array(Buffer.from(a.account.data[0], 'base64'))),
      }));
    } catch {
      return [];
    }
  }, []);

  const getAllSkillListings = useCallback(async () => {
    try {
      const accounts = await rpc.getProgramAccounts(REPUTATION_ORACLE_PROGRAM_ADDRESS, {
        encoding: 'base64',
        filters: [{ memcmp: { offset: 0n, bytes: asBase64(SKILL_LISTING_DISCRIMINATOR), encoding: 'base64' } }],
      }).send();
      const decoder = getSkillListingDecoder();
      return accounts.map((a) => ({
        publicKey: a.pubkey,
        account: decoder.decode(new Uint8Array(Buffer.from(a.account.data[0], 'base64'))),
      }));
    } catch (e) {
      console.error('Error fetching skill listings:', e);
      return [];
    }
  }, []);

  const getSkillListingsByAuthor = useCallback(async (author: Address) => {
    try {
      const accounts = await rpc.getProgramAccounts(REPUTATION_ORACLE_PROGRAM_ADDRESS, {
        encoding: 'base64',
        filters: [
          { memcmp: { offset: 0n, bytes: asBase64(SKILL_LISTING_DISCRIMINATOR), encoding: 'base64' } },
          { memcmp: { offset: 8n, bytes: asBase58(author), encoding: 'base58' } },
        ],
      }).send();
      const decoder = getSkillListingDecoder();
      return accounts.map((a) => ({
        publicKey: a.pubkey,
        account: decoder.decode(new Uint8Array(Buffer.from(a.account.data[0], 'base64'))),
      }));
    } catch {
      return [];
    }
  }, []);

  const getAllPurchases = useCallback(async () => {
    try {
      const accounts = await rpc.getProgramAccounts(REPUTATION_ORACLE_PROGRAM_ADDRESS, {
        encoding: 'base64',
        filters: [{ memcmp: { offset: 0n, bytes: asBase64(PURCHASE_DISCRIMINATOR), encoding: 'base64' } }],
      }).send();
      const decoder = getPurchaseDecoder();
      return accounts.map((a) => ({
        publicKey: a.pubkey,
        account: decoder.decode(new Uint8Array(Buffer.from(a.account.data[0], 'base64'))),
      }));
    } catch {
      return [];
    }
  }, []);

  const getPurchasesByBuyer = useCallback(async (buyer: Address) => {
    try {
      const accounts = await rpc.getProgramAccounts(REPUTATION_ORACLE_PROGRAM_ADDRESS, {
        encoding: 'base64',
        filters: [
          { memcmp: { offset: 0n, bytes: asBase64(PURCHASE_DISCRIMINATOR), encoding: 'base64' } },
          { memcmp: { offset: 8n, bytes: asBase58(buyer), encoding: 'base58' } },
        ],
      }).send();
      const decoder = getPurchaseDecoder();
      return accounts.map((a) => ({
        publicKey: a.pubkey,
        account: decoder.decode(new Uint8Array(Buffer.from(a.account.data[0], 'base64'))),
      }));
    } catch {
      return [];
    }
  }, []);

  const createSkillListing = useCallback(async (
    skillId: string,
    skillUri: string,
    name: string,
    description: string,
    priceLamports: number,
  ) => {
    if (!signer || !walletAddress) throw new Error('Wallet not connected');
    const ix = await getCreateSkillListingInstructionAsync({
      author: signer,
      skillId,
      skillUri,
      name,
      description,
      priceLamports: BigInt(priceLamports),
    });
    return { tx: await sendIx(ix) };
  }, [signer, walletAddress, sendIx]);

  const updateSkillListing = useCallback(async (
    skillId: string,
    skillUri: string,
    name: string,
    description: string,
    priceLamports: number,
  ) => {
    if (!signer || !walletAddress) throw new Error('Wallet not connected');
    const ix = await getUpdateSkillListingInstructionAsync({
      author: signer,
      skillId,
      skillUri,
      name,
      description,
      priceLamports: BigInt(priceLamports),
    });
    return { tx: await sendIx(ix) };
  }, [signer, walletAddress, sendIx]);

  const purchaseSkill = useCallback(async (skillListingKey: Address, authorKey: Address) => {
    if (!signer || !walletAddress) throw new Error('Wallet not connected');
    const authorProfile = await getAgentPDA(authorKey);
    const ix = await getPurchaseSkillInstructionAsync({
      skillListing: skillListingKey,
      author: authorKey,
      authorProfile,
      buyer: signer,
    });
    return { tx: await sendIx(ix) };
  }, [signer, walletAddress, sendIx]);

  return {
    connected: !!connected,
    walletAddress,
    registerAgent,
    vouch,
    revokeVouch,
    openDispute,
    getAgentProfile,
    getAllVouchesForAgent,
    getAllVouchesReceivedByAgent,
    getAllAgents,
    getAllSkillListings,
    getSkillListingsByAuthor,
    getAllPurchases,
    getPurchasesByBuyer,
    createSkillListing,
    updateSkillListing,
    purchaseSkill,
    getAgentPDA,
    getVouchPDA,
    getConfigPDA,
    getSkillListingPDA,
    getPurchasePDA,
  };
}
