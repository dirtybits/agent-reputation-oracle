import {
  createSolanaRpc,
  getAddressEncoder,
  getProgramDerivedAddress,
  getUtf8Encoder,
  type Address,
} from "@solana/kit";
import { fetchMaybeAgentProfile } from "../generated/reputation-oracle/src/generated";
import { REPUTATION_ORACLE_PROGRAM_ADDRESS } from "../generated/reputation-oracle/src/generated/programs";
import {
  resolveAuthorDisputeMetrics,
  resolveMultipleAuthorDisputeMetrics,
  type AuthorDisputeMetrics,
} from "./authorDisputes";
import { getErrorMessage } from "./errors";

const RPC_URL = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
const rpc = createSolanaRpc(RPC_URL);

export interface AuthorTrust {
  reputationScore: number;
  totalVouchesReceived: number;
  totalStakedFor: number;
  disputesAgainstAuthor: number;
  disputesUpheldAgainstAuthor: number;
  activeDisputesAgainstAuthor: number;
  registeredAt: number;
  isRegistered: boolean;
}

export class AuthorTrustVerificationError extends Error {
  constructor(message = "Unable to verify author trust") {
    super(message);
    this.name = "AuthorTrustVerificationError";
  }
}

const cache = new Map<string, { data: AuthorTrust; expires: number }>();
const CACHE_TTL_MS = 60_000;

const textEncoder = getUtf8Encoder();
const addressEncoder = getAddressEncoder();

async function getAgentPDA(agentKey: Address): Promise<Address> {
  const [derived] = await getProgramDerivedAddress({
    programAddress: REPUTATION_ORACLE_PROGRAM_ADDRESS,
    seeds: [textEncoder.encode("agent"), addressEncoder.encode(agentKey)],
  });
  return derived;
}

export async function resolveAuthorTrust(pubkey: string): Promise<AuthorTrust> {
  const now = Date.now();
  const cached = cache.get(pubkey);
  if (cached && cached.expires > now) {
    return cached.data;
  }

  const defaultTrust: AuthorTrust = {
    reputationScore: 0,
    totalVouchesReceived: 0,
    totalStakedFor: 0,
    disputesAgainstAuthor: 0,
    disputesUpheldAgainstAuthor: 0,
    activeDisputesAgainstAuthor: 0,
    registeredAt: 0,
    isRegistered: false,
  };

  try {
    const disputeMetrics = await resolveAuthorDisputeMetrics(pubkey);
    const agentPDA = await getAgentPDA(pubkey as Address);
    const account = await fetchMaybeAgentProfile(rpc, agentPDA);

    if (!account.exists) {
      const next = { ...defaultTrust, ...disputeMetrics };
      cache.set(pubkey, { data: next, expires: now + CACHE_TTL_MS });
      return next;
    }

    const d = account.data;
    const trust: AuthorTrust = {
      reputationScore: Number(d.reputationScore),
      totalVouchesReceived: d.totalVouchesReceived,
      totalStakedFor: Number(d.totalStakedFor),
      disputesAgainstAuthor: disputeMetrics.disputesAgainstAuthor,
      disputesUpheldAgainstAuthor: disputeMetrics.disputesUpheldAgainstAuthor,
      activeDisputesAgainstAuthor: disputeMetrics.activeDisputesAgainstAuthor,
      registeredAt: Number(d.registeredAt),
      isRegistered: true,
    };

    cache.set(pubkey, { data: trust, expires: now + CACHE_TTL_MS });
    return trust;
  } catch {
    cache.set(pubkey, { data: defaultTrust, expires: now + CACHE_TTL_MS });
    return defaultTrust;
  }
}

export async function verifyAuthorTrust(pubkey: string): Promise<AuthorTrust> {
  const defaultTrust: AuthorTrust = {
    reputationScore: 0,
    totalVouchesReceived: 0,
    totalStakedFor: 0,
    disputesAgainstAuthor: 0,
    disputesUpheldAgainstAuthor: 0,
    activeDisputesAgainstAuthor: 0,
    registeredAt: 0,
    isRegistered: false,
  };

  try {
    const disputeMetrics = await resolveAuthorDisputeMetrics(pubkey, false);
    const agentPDA = await getAgentPDA(pubkey as Address);
    const account = await fetchMaybeAgentProfile(rpc, agentPDA);

    if (!account.exists) {
      return { ...defaultTrust, ...disputeMetrics };
    }

    const d = account.data;
    return {
      reputationScore: Number(d.reputationScore),
      totalVouchesReceived: d.totalVouchesReceived,
      totalStakedFor: Number(d.totalStakedFor),
      disputesAgainstAuthor: disputeMetrics.disputesAgainstAuthor,
      disputesUpheldAgainstAuthor: disputeMetrics.disputesUpheldAgainstAuthor,
      activeDisputesAgainstAuthor: disputeMetrics.activeDisputesAgainstAuthor,
      registeredAt: Number(d.registeredAt),
      isRegistered: true,
    };
  } catch (error: unknown) {
    throw new AuthorTrustVerificationError(
      getErrorMessage(error, "Unable to verify on-chain author profile")
    );
  }
}

export async function resolveMultipleAuthorTrust(
  pubkeys: string[]
): Promise<Map<string, AuthorTrust>> {
  const unique = [...new Set(pubkeys)];
  const disputeMetricsByAuthor = await resolveMultipleAuthorDisputeMetrics(
    unique
  );
  const results = await Promise.all(
    unique.map(async (pubkey) => {
      const trust = await resolveAuthorTrust(pubkey);
      const disputeMetrics: AuthorDisputeMetrics = disputeMetricsByAuthor.get(
        pubkey
      ) ?? {
        disputesAgainstAuthor: 0,
        disputesUpheldAgainstAuthor: 0,
        activeDisputesAgainstAuthor: 0,
      };
      return {
        ...trust,
        disputesAgainstAuthor: disputeMetrics.disputesAgainstAuthor,
        disputesUpheldAgainstAuthor: disputeMetrics.disputesUpheldAgainstAuthor,
        activeDisputesAgainstAuthor: disputeMetrics.activeDisputesAgainstAuthor,
      };
    })
  );
  const map = new Map<string, AuthorTrust>();
  unique.forEach((pk, i) => map.set(pk, results[i]));
  return map;
}
