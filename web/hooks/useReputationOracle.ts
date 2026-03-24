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
  type Account,
  type TransactionSigner,
} from '@solana/kit';
import { createWalletTransactionSigner } from '@solana/client';
import type { Base64EncodedBytes, Base58EncodedBytes } from '@solana/rpc-types';

const asBase64 = (bytes: Uint8Array) =>
  Buffer.from(bytes).toString('base64') as Base64EncodedBytes;
const asBase58 = (addr: string) => addr as unknown as Base58EncodedBytes;
import {
  fetchMaybeAgentProfile,
  fetchMaybeAuthorDispute,
  fetchMaybeReputationConfig,
  getAuthorDisputeDecoder,
  getLinkAuthorDisputeVouchInstructionAsync,
  getOpenAuthorDisputeInstructionAsync,
  getResolveAuthorDisputeInstructionAsync,
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
  AUTHOR_DISPUTE_DISCRIMINATOR,
  SKILL_LISTING_DISCRIMINATOR,
  VOUCH_DISCRIMINATOR,
  PURCHASE_DISCRIMINATOR,
  AuthorDisputeReason,
  AuthorDisputeRuling,
  type AuthorDispute,
  type AgentProfile,
  type ReputationConfig,
  type SkillListing,
  type Vouch as VouchAccount,
  type Purchase,
} from '../generated/reputation-oracle/src/generated';
import { REPUTATION_ORACLE_PROGRAM_ADDRESS } from '../generated/reputation-oracle/src/generated/programs';
import {
  listAuthorDisputeLinks,
  listAuthorDisputesByAuthor,
  type AuthorDisputeRecord,
} from '@/lib/authorDisputes';

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

async function getAuthorDisputePDA(author: Address, disputeId: number | bigint): Promise<Address> {
  const disputeIdSeed = Buffer.alloc(8);
  disputeIdSeed.writeBigUInt64LE(BigInt(disputeId));
  const [derived] = await getProgramDerivedAddress({
    programAddress: REPUTATION_ORACLE_PROGRAM_ADDRESS,
    seeds: [
      textEncoder.encode('author_dispute'),
      addressEncoder.encode(author),
      disputeIdSeed,
    ],
  });
  return derived;
}

async function getAuthorDisputeVouchLinkPDA(authorDispute: Address, vouch: Address): Promise<Address> {
  const [derived] = await getProgramDerivedAddress({
    programAddress: REPUTATION_ORACLE_PROGRAM_ADDRESS,
    seeds: [
      textEncoder.encode('author_dispute_vouch_link'),
      addressEncoder.encode(authorDispute),
      addressEncoder.encode(vouch),
    ],
  });
  return derived;
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

  const getConfig = useCallback(async (): Promise<ReputationConfig | null> => {
    try {
      const configPda = await getConfigPDA();
      const account = await fetchMaybeReputationConfig(rpc, configPda);
      if (!account.exists) return null;
      return account.data;
    } catch {
      return null;
    }
  }, []);

  const getAuthorDisputeByAddress = useCallback(async (disputeAddress: Address) => {
    try {
      const account = await fetchMaybeAuthorDispute(rpc, disputeAddress);
      if (!account.exists) return null;
      return account.data;
    } catch {
      return null;
    }
  }, []);

  const getAuthorDisputesByAuthor = useCallback(async (authorKey: Address) => {
    return listAuthorDisputesByAuthor(String(authorKey));
  }, []);

  const getAuthorDisputeLinks = useCallback(async (authorDisputeAddress: Address) => {
    return listAuthorDisputeLinks(String(authorDisputeAddress));
  }, []);

  const getAllAuthorDisputes = useCallback(async () => {
    try {
      const accounts = await rpc.getProgramAccounts(REPUTATION_ORACLE_PROGRAM_ADDRESS, {
        encoding: 'base64',
        filters: [
          {
            memcmp: {
              offset: 0n,
              bytes: asBase64(AUTHOR_DISPUTE_DISCRIMINATOR),
              encoding: 'base64',
            },
          },
        ],
      }).send();
      const decoder = getAuthorDisputeDecoder();
      const records = accounts.map((account) => ({
        publicKey: account.pubkey,
        account: decoder.decode(new Uint8Array(Buffer.from(account.account.data[0], 'base64'))),
      }));
      const linkedVouchesByDispute = new Map<string, string[]>();
      await Promise.all(
        records.map(async (record) => {
          const linkedVouches = await listAuthorDisputeLinks(record.publicKey);
          linkedVouchesByDispute.set(record.publicKey, linkedVouches);
        }),
      );
      return records
        .map((record) => {
          const reasonLabel = AuthorDisputeReason[record.account.reason] ?? 'Unknown';
          const statusLabel = record.account.status === 0 ? 'Open' : 'Resolved';
          const rulingOption = record.account.ruling as unknown as
            | { __option?: 'Some' | 'None'; value?: AuthorDisputeRuling }
            | null
            | undefined;
          const rulingValue =
            rulingOption && rulingOption.__option === 'Some'
              ? rulingOption.value ?? null
              : null;
          const rulingLabel =
            rulingValue === null || rulingValue === undefined
              ? null
              : AuthorDisputeRuling[rulingValue] ?? 'Unknown';
          return {
            publicKey: record.publicKey,
            account: record.account,
            linkedVouches: linkedVouchesByDispute.get(record.publicKey) ?? [],
            reasonLabel,
            statusLabel,
            rulingLabel,
          };
        })
        .sort((a, b) => Number(b.account.createdAt) - Number(a.account.createdAt));
    } catch (error) {
      console.error('Error fetching author disputes:', error);
      return [];
    }
  }, []);

  const openAuthorDispute = useCallback(async (
    authorKey: Address,
    params: {
      reason: AuthorDisputeReason;
      evidenceUri: string;
      skillListing?: Address;
      purchase?: Address;
      linkedVouches?: Address[];
      disputeId?: number | bigint;
    },
  ) => {
    if (!signer || !walletAddress) throw new Error('Wallet not connected');

    const authorProfile = await getAgentPDA(authorKey);
    const disputeId = params.disputeId ?? BigInt(Date.now());
    const authorDispute = await getAuthorDisputePDA(authorKey, disputeId);
    const openIx = await getOpenAuthorDisputeInstructionAsync({
      authorDispute,
      authorProfile,
      challenger: signer,
      disputeId,
      reason: params.reason,
      evidenceUri: params.evidenceUri,
      skillListing: params.skillListing,
      purchase: params.purchase,
    });
    const tx = await sendIx(openIx);

    const linkedVouches = [...new Set((params.linkedVouches ?? []).map((vouch) => String(vouch)))].map(
      (vouch) => address(vouch),
    );
    const linkTxs: string[] = [];
    try {
      for (const vouch of linkedVouches) {
        const authorDisputeVouchLink = await getAuthorDisputeVouchLinkPDA(authorDispute, vouch);
        const linkIx = await getLinkAuthorDisputeVouchInstructionAsync({
          authorDispute,
          authorDisputeVouchLink,
          vouch,
          authorProfile,
          challenger: signer,
          disputeId,
        });
        linkTxs.push(await sendIx(linkIx));
      }
    } catch (error: any) {
      throw new Error(
        `Author dispute opened, but linking backing vouches failed: ${error?.message || 'unknown error'}`,
      );
    }

    return { tx, linkTxs, authorDispute, disputeId };
  }, [signer, walletAddress, sendIx]);

  const resolveAuthorDispute = useCallback(async (
    authorKey: Address,
    disputeId: number | bigint,
    ruling: AuthorDisputeRuling,
    challenger: Address,
  ) => {
    if (!signer || !walletAddress) throw new Error('Wallet not connected');
    const authorProfile = await getAgentPDA(authorKey);
    const authorDispute = await getAuthorDisputePDA(authorKey, disputeId);
    const ix = await getResolveAuthorDisputeInstructionAsync({
      authorDispute,
      authorProfile,
      authority: signer,
      challenger,
      disputeId,
      ruling,
    });
    return { tx: await sendIx(ix), authorDispute };
  }, [signer, walletAddress, sendIx]);

  const getAgentProfileByAddress = useCallback(async (profileAddress: Address) => {
    try {
      const account = await fetchMaybeAgentProfile(rpc, profileAddress);
      if (!account.exists) return null;
      return account.data;
    } catch {
      return null;
    }
  }, []);

  const getAgentProfile = useCallback(async (agentKey: Address) => {
    const pda = await getAgentPDA(agentKey);
    return getAgentProfileByAddress(pda);
  }, [getAgentProfileByAddress]);

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
      const agentProfile = await getAgentPDA(agentKey);
      const accounts = await rpc.getProgramAccounts(REPUTATION_ORACLE_PROGRAM_ADDRESS, {
        encoding: 'base64',
        filters: [
          { memcmp: { offset: 0n, bytes: asBase64(VOUCH_DISCRIMINATOR), encoding: 'base64' } },
          { memcmp: { offset: 8n, bytes: asBase58(agentProfile), encoding: 'base58' } },
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
      const agentProfile = await getAgentPDA(agentKey);
      const accounts = await rpc.getProgramAccounts(REPUTATION_ORACLE_PROGRAM_ADDRESS, {
        encoding: 'base64',
        filters: [
          { memcmp: { offset: 0n, bytes: asBase64(VOUCH_DISCRIMINATOR), encoding: 'base64' } },
          { memcmp: { offset: 40n, bytes: asBase58(agentProfile), encoding: 'base58' } },
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
    openAuthorDispute,
    resolveAuthorDispute,
    getConfig,
    getAgentProfile,
    getAgentProfileByAddress,
    getAuthorDisputeByAddress,
    getAuthorDisputesByAuthor,
    getAuthorDisputeLinks,
    getAllAuthorDisputes,
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
    getAuthorDisputePDA,
    getAuthorDisputeVouchLinkPDA,
    getSkillListingPDA,
    getPurchasePDA,
  };
}
