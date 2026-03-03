import {
  createSolanaRpc,
  getAddressEncoder,
  getProgramDerivedAddress,
  getUtf8Encoder,
  type Address,
} from '@solana/kit';
import { fetchMaybeAgentProfile } from '../generated/reputation-oracle/src/generated';
import { REPUTATION_ORACLE_PROGRAM_ADDRESS } from '../generated/reputation-oracle/src/generated/programs';

const RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
const rpc = createSolanaRpc(RPC_URL);

export interface AuthorTrust {
  reputationScore: number;
  totalVouchesReceived: number;
  totalStakedFor: number;
  disputesWon: number;
  disputesLost: number;
  registeredAt: number;
  isRegistered: boolean;
}

const cache = new Map<string, { data: AuthorTrust; expires: number }>();
const CACHE_TTL_MS = 60_000;

const textEncoder = getUtf8Encoder();
const addressEncoder = getAddressEncoder();

async function getAgentPDA(agentKey: Address): Promise<Address> {
  const [derived] = await getProgramDerivedAddress({
    programAddress: REPUTATION_ORACLE_PROGRAM_ADDRESS,
    seeds: [
      textEncoder.encode('agent'),
      addressEncoder.encode(agentKey),
    ],
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
    disputesWon: 0,
    disputesLost: 0,
    registeredAt: 0,
    isRegistered: false,
  };

  try {
    const agentPDA = await getAgentPDA(pubkey as Address);
    const account = await fetchMaybeAgentProfile(rpc, agentPDA);

    if (!account.exists) {
      cache.set(pubkey, { data: defaultTrust, expires: now + CACHE_TTL_MS });
      return defaultTrust;
    }

    const d = account.data;
    const trust: AuthorTrust = {
      reputationScore: Number(d.reputationScore),
      totalVouchesReceived: d.totalVouchesReceived,
      totalStakedFor: Number(d.totalStakedFor),
      disputesWon: d.disputesWon,
      disputesLost: d.disputesLost,
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

export async function resolveMultipleAuthorTrust(
  pubkeys: string[]
): Promise<Map<string, AuthorTrust>> {
  const unique = [...new Set(pubkeys)];
  const results = await Promise.all(unique.map(resolveAuthorTrust));
  const map = new Map<string, AuthorTrust>();
  unique.forEach((pk, i) => map.set(pk, results[i]));
  return map;
}
