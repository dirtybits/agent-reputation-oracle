import { createSolanaRpc } from '@solana/kit';
import type { Base58EncodedBytes, Base64EncodedBytes } from '@solana/rpc-types';
import {
  AUTHOR_DISPUTE_DISCRIMINATOR,
  AuthorDisputeReason,
  AuthorDisputeRuling,
  AuthorDisputeStatus,
  getAuthorDisputeDecoder,
  type AuthorDispute,
} from '../generated/reputation-oracle/src/generated';
import { REPUTATION_ORACLE_PROGRAM_ADDRESS } from '../generated/reputation-oracle/src/generated/programs';

const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
const rpc = createSolanaRpc(RPC_URL);
const CACHE_TTL_MS = 60_000;

const asBase64 = (bytes: Uint8Array) =>
  Buffer.from(bytes).toString('base64') as Base64EncodedBytes;
const asBase58 = (value: string) => value as unknown as Base58EncodedBytes;

type DecodedAuthorDisputeAccount = {
  publicKey: string;
  account: AuthorDispute;
};

export interface AuthorDisputeMetrics {
  disputesAgainstAuthor: number;
  disputesUpheldAgainstAuthor: number;
  activeDisputesAgainstAuthor: number;
}

export interface AuthorDisputeRecord {
  publicKey: string;
  disputeId: string;
  author: string;
  challenger: string;
  reason: AuthorDisputeReason;
  reasonLabel: string;
  evidenceUri: string;
  status: AuthorDisputeStatus;
  statusLabel: string;
  ruling: AuthorDisputeRuling | null;
  rulingLabel: string | null;
  skillListing: string | null;
  purchase: string | null;
  backingVouchCountSnapshot: number;
  linkedVouchCount: number;
  linkedVouches: string[];
  bondAmount: number;
  createdAt: number;
  resolvedAt: number | null;
}

let allDisputesCache:
  | { expires: number; data: DecodedAuthorDisputeAccount[] }
  | null = null;

function unwrapOption<T>(value: unknown): T | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'object') {
    const maybeOption = value as Record<string, unknown>;
    if ('value' in maybeOption) {
      return (maybeOption.value as T | null) ?? null;
    }
    if ('__option' in maybeOption) {
      return maybeOption.__option === 'Some' ? (maybeOption.value as T | null) ?? null : null;
    }
  }
  return value as T;
}

export function getAuthorDisputeReasonLabel(reason: AuthorDisputeReason | number): string {
  switch (reason) {
    case AuthorDisputeReason.MaliciousSkill:
      return 'Malicious skill';
    case AuthorDisputeReason.FraudulentClaims:
      return 'Fraudulent claims';
    case AuthorDisputeReason.FailedDelivery:
      return 'Failed delivery';
    case AuthorDisputeReason.Other:
      return 'Other';
    default:
      return 'Unknown';
  }
}

export function getAuthorDisputeStatusLabel(status: AuthorDisputeStatus | number): string {
  switch (status) {
    case AuthorDisputeStatus.Open:
      return 'Open';
    case AuthorDisputeStatus.Resolved:
      return 'Resolved';
    default:
      return 'Unknown';
  }
}

export function getAuthorDisputeRulingLabel(
  ruling: AuthorDisputeRuling | number | null | undefined,
): string | null {
  if (ruling === null || ruling === undefined) return null;
  switch (ruling) {
    case AuthorDisputeRuling.Upheld:
      return 'Upheld';
    case AuthorDisputeRuling.Dismissed:
      return 'Dismissed';
    default:
      return 'Unknown';
  }
}

async function getAllAuthorDisputeAccounts(
  useCache = true,
): Promise<DecodedAuthorDisputeAccount[]> {
  const now = Date.now();
  if (useCache && allDisputesCache && allDisputesCache.expires > now) {
    return allDisputesCache.data;
  }

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
  const data = accounts.map((account) => ({
    publicKey: account.pubkey,
    account: decoder.decode(new Uint8Array(Buffer.from(account.account.data[0], 'base64'))),
  }));

  allDisputesCache = { data, expires: now + CACHE_TTL_MS };
  return data;
}

export async function listAuthorDisputesByAuthor(
  authorPubkey: string,
  options: { includeLinks?: boolean; useCache?: boolean } = {},
): Promise<AuthorDisputeRecord[]> {
  const useCache = options.useCache ?? true;
  const includeLinks = options.includeLinks ?? true;
  const disputes = await getAllAuthorDisputeAccounts(useCache);
  const authorDisputes = disputes.filter(
    (dispute) => String(dispute.account.author) === authorPubkey,
  );

  return authorDisputes
    .map((dispute) => {
      const ruling = unwrapOption<AuthorDisputeRuling>(dispute.account.ruling);
      const skillListing = unwrapOption<string>(dispute.account.skillListing);
      const purchase = unwrapOption<string>(dispute.account.purchase);
      const resolvedAt = unwrapOption<bigint>(dispute.account.resolvedAt);
      return {
        publicKey: dispute.publicKey,
        disputeId: dispute.account.disputeId.toString(),
        author: String(dispute.account.author),
        challenger: String(dispute.account.challenger),
        reason: dispute.account.reason,
        reasonLabel: getAuthorDisputeReasonLabel(dispute.account.reason),
        evidenceUri: dispute.account.evidenceUri,
        status: dispute.account.status,
        statusLabel: getAuthorDisputeStatusLabel(dispute.account.status),
        ruling,
        rulingLabel: getAuthorDisputeRulingLabel(ruling),
        skillListing,
        purchase,
        backingVouchCountSnapshot: dispute.account.backingVouchCountSnapshot,
        linkedVouchCount: dispute.account.linkedVouchCount,
        linkedVouches: includeLinks ? [] : [],
        bondAmount: Number(dispute.account.bondAmount),
        createdAt: Number(dispute.account.createdAt),
        resolvedAt: resolvedAt === null ? null : Number(resolvedAt),
      };
    })
    .sort((a, b) => b.createdAt - a.createdAt);
}

export async function resolveAuthorDisputeMetrics(
  authorPubkey: string,
  useCache = true,
): Promise<AuthorDisputeMetrics> {
  const disputes = await getAllAuthorDisputeAccounts(useCache);
  const metrics: AuthorDisputeMetrics = {
    disputesAgainstAuthor: 0,
    disputesUpheldAgainstAuthor: 0,
    activeDisputesAgainstAuthor: 0,
  };

  for (const dispute of disputes) {
    if (String(dispute.account.author) !== authorPubkey) continue;
    metrics.disputesAgainstAuthor += 1;
    if (dispute.account.status === AuthorDisputeStatus.Open) {
      metrics.activeDisputesAgainstAuthor += 1;
    }
    if (unwrapOption<AuthorDisputeRuling>(dispute.account.ruling) === AuthorDisputeRuling.Upheld) {
      metrics.disputesUpheldAgainstAuthor += 1;
    }
  }

  return metrics;
}

export async function resolveMultipleAuthorDisputeMetrics(
  authorPubkeys: string[],
  useCache = true,
): Promise<Map<string, AuthorDisputeMetrics>> {
  const unique = [...new Set(authorPubkeys)];
  const metrics = new Map<string, AuthorDisputeMetrics>();
  for (const authorPubkey of unique) {
    metrics.set(authorPubkey, {
      disputesAgainstAuthor: 0,
      disputesUpheldAgainstAuthor: 0,
      activeDisputesAgainstAuthor: 0,
    });
  }

  if (unique.length === 0) {
    return metrics;
  }

  const authorSet = new Set(unique);
  const disputes = await getAllAuthorDisputeAccounts(useCache);
  for (const dispute of disputes) {
    const author = String(dispute.account.author);
    if (!authorSet.has(author)) continue;

    const next = metrics.get(author)!;
    next.disputesAgainstAuthor += 1;
    if (dispute.account.status === AuthorDisputeStatus.Open) {
      next.activeDisputesAgainstAuthor += 1;
    }
    if (unwrapOption<AuthorDisputeRuling>(dispute.account.ruling) === AuthorDisputeRuling.Upheld) {
      next.disputesUpheldAgainstAuthor += 1;
    }
  }

  return metrics;
}

export async function getAuthorDisputePublicKeysByAuthor(
  authorPubkey: string,
  useCache = true,
): Promise<string[]> {
  const all = await getAllAuthorDisputeAccounts(useCache);
  return all
    .filter((dispute) => String(dispute.account.author) === authorPubkey)
    .map((dispute) => dispute.publicKey);
}

export async function listAuthorDisputeLinks(
  authorDisputePubkey: string,
  _useCache = true,
): Promise<string[]> {
  void authorDisputePubkey;
  return [];
}

export async function listAuthorDisputesByAuthorViaFilter(
  authorPubkey: string,
): Promise<DecodedAuthorDisputeAccount[]> {
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
      {
        memcmp: {
          offset: 16n,
          bytes: asBase58(authorPubkey),
          encoding: 'base58',
        },
      },
    ],
  }).send();
  const decoder = getAuthorDisputeDecoder();
  return accounts.map((account) => ({
    publicKey: account.pubkey,
    account: decoder.decode(new Uint8Array(Buffer.from(account.account.data[0], 'base64'))),
  }));
}
