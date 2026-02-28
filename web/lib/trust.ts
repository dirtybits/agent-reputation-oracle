import { Connection, PublicKey, clusterApiUrl } from '@solana/web3.js';
import { Program, AnchorProvider } from '@coral-xyz/anchor';
import IDL from '../reputation_oracle.json';

const PROGRAM_ID = new PublicKey('ELmVnLSNuwNca4PfPqeqNowoUF8aDdtfto3rF9d89wf');
const RPC_URL = process.env.SOLANA_RPC_URL || clusterApiUrl('devnet');

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

export function getReadOnlyProgram() {
  const connection = new Connection(RPC_URL, 'confirmed');
  const provider = new AnchorProvider(
    connection,
    {} as any,
    { commitment: 'confirmed' }
  );
  return new Program(IDL as any, provider);
}

function getAgentPDA(agentKey: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('agent'), agentKey.toBuffer()],
    PROGRAM_ID
  )[0];
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
    const program = getReadOnlyProgram();
    const agentPDA = getAgentPDA(new PublicKey(pubkey));
    const account = await (program.account as any).agentProfile.fetch(agentPDA);

    const toNum = (v: any) => v?.toNumber?.() ?? v ?? 0;

    const trust: AuthorTrust = {
      reputationScore: toNum(account.reputationScore),
      totalVouchesReceived: toNum(account.totalVouchesReceived),
      totalStakedFor: toNum(account.totalStakedFor),
      disputesWon: toNum(account.disputesWon),
      disputesLost: toNum(account.disputesLost),
      registeredAt: toNum(account.registeredAt),
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
