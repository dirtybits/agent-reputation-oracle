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
import { IN_MEMORY_CACHE_TTL_MS } from "./cachePolicy";
import { getErrorMessage } from "./errors";
import { DEFAULT_SOLANA_RPC_URL } from "./solanaRpc";

const RPC_URL = DEFAULT_SOLANA_RPC_URL;
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
const CACHE_TTL_MS = IN_MEMORY_CACHE_TTL_MS.authorTrust;

const textEncoder = getUtf8Encoder();
const addressEncoder = getAddressEncoder();

async function getAgentPDA(agentKey: Address): Promise<Address> {
  const [derived] = await getProgramDerivedAddress({
    programAddress: REPUTATION_ORACLE_PROGRAM_ADDRESS,
    seeds: [textEncoder.encode("agent"), addressEncoder.encode(agentKey)],
  });
  return derived;
}

function getDefaultTrust(): AuthorTrust {
  return {
    reputationScore: 0,
    totalVouchesReceived: 0,
    totalStakedFor: 0,
    disputesAgainstAuthor: 0,
    disputesUpheldAgainstAuthor: 0,
    activeDisputesAgainstAuthor: 0,
    registeredAt: 0,
    isRegistered: false,
  };
}

function mergeAuthorTrust(
  base: AuthorTrust,
  disputeMetrics: AuthorDisputeMetrics
): AuthorTrust {
  return {
    ...base,
    disputesAgainstAuthor: disputeMetrics.disputesAgainstAuthor,
    disputesUpheldAgainstAuthor: disputeMetrics.disputesUpheldAgainstAuthor,
    activeDisputesAgainstAuthor: disputeMetrics.activeDisputesAgainstAuthor,
  };
}

export async function resolveAuthorTrust(pubkey: string): Promise<AuthorTrust> {
  const now = Date.now();
  const cached = cache.get(pubkey);
  if (cached && cached.expires > now) {
    return cached.data;
  }

  const defaultTrust = getDefaultTrust();

  try {
    const disputeMetrics = await resolveAuthorDisputeMetrics(pubkey);
    const agentPDA = await getAgentPDA(pubkey as Address);
    const account = await fetchMaybeAgentProfile(rpc, agentPDA);

    if (!account.exists) {
      const next = mergeAuthorTrust(defaultTrust, disputeMetrics);
      cache.set(pubkey, { data: next, expires: now + CACHE_TTL_MS });
      return next;
    }

    const d = account.data;
    const trust = mergeAuthorTrust(
      {
      reputationScore: Number(d.reputationScore),
      totalVouchesReceived: d.totalVouchesReceived,
      totalStakedFor: Number(d.totalStakedFor),
      registeredAt: Number(d.registeredAt),
      isRegistered: true,
        disputesAgainstAuthor: 0,
        disputesUpheldAgainstAuthor: 0,
        activeDisputesAgainstAuthor: 0,
      },
      disputeMetrics
    );

    cache.set(pubkey, { data: trust, expires: now + CACHE_TTL_MS });
    return trust;
  } catch {
    cache.set(pubkey, { data: defaultTrust, expires: now + CACHE_TTL_MS });
    return defaultTrust;
  }
}

export async function verifyAuthorTrust(pubkey: string): Promise<AuthorTrust> {
  const defaultTrust = getDefaultTrust();

  try {
    const disputeMetrics = await resolveAuthorDisputeMetrics(pubkey, false);
    const agentPDA = await getAgentPDA(pubkey as Address);
    const account = await fetchMaybeAgentProfile(rpc, agentPDA);

    if (!account.exists) {
      return mergeAuthorTrust(defaultTrust, disputeMetrics);
    }

    const d = account.data;
    return mergeAuthorTrust(
      {
        reputationScore: Number(d.reputationScore),
        totalVouchesReceived: d.totalVouchesReceived,
        totalStakedFor: Number(d.totalStakedFor),
        registeredAt: Number(d.registeredAt),
        isRegistered: true,
        disputesAgainstAuthor: 0,
        disputesUpheldAgainstAuthor: 0,
        activeDisputesAgainstAuthor: 0,
      },
      disputeMetrics
    );
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
      const disputeMetrics: AuthorDisputeMetrics = disputeMetricsByAuthor.get(
        pubkey
      ) ?? {
        disputesAgainstAuthor: 0,
        disputesUpheldAgainstAuthor: 0,
        activeDisputesAgainstAuthor: 0,
      };

      const now = Date.now();
      const cached = cache.get(pubkey);
      if (cached && cached.expires > now) {
        return mergeAuthorTrust(cached.data, disputeMetrics);
      }

      const agentPDA = await getAgentPDA(pubkey as Address);
      const account = await fetchMaybeAgentProfile(rpc, agentPDA);
      const trust = !account.exists
        ? mergeAuthorTrust(getDefaultTrust(), disputeMetrics)
        : mergeAuthorTrust(
            {
              reputationScore: Number(account.data.reputationScore),
              totalVouchesReceived: account.data.totalVouchesReceived,
              totalStakedFor: Number(account.data.totalStakedFor),
              registeredAt: Number(account.data.registeredAt),
              isRegistered: true,
              disputesAgainstAuthor: 0,
              disputesUpheldAgainstAuthor: 0,
              activeDisputesAgainstAuthor: 0,
            },
            disputeMetrics
          );

      cache.set(pubkey, { data: trust, expires: now + CACHE_TTL_MS });
      return trust;
    })
  );
  const map = new Map<string, AuthorTrust>();
  unique.forEach((pk, i) => map.set(pk, results[i]));
  return map;
}
