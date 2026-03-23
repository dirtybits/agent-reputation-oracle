import { NextResponse } from 'next/server';
import { createSolanaRpc } from '@solana/kit';
import type { Base64EncodedBytes } from '@solana/rpc-types';
import {
  getSkillListingDecoder,
  SKILL_LISTING_DISCRIMINATOR,
  getAgentProfileDecoder,
  AGENT_PROFILE_DISCRIMINATOR,
} from '../../../generated/reputation-oracle/src/generated';
import { REPUTATION_ORACLE_PROGRAM_ADDRESS } from '../../../generated/reputation-oracle/src/generated/programs';
import { resolveManyAgentIdentitiesByWallet } from '@/lib/agentIdentity';

const rpc = createSolanaRpc(process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com');
const asBase64 = (bytes: Uint8Array) =>
  Buffer.from(bytes).toString('base64') as Base64EncodedBytes;

export async function GET() {
  try {
    const [skillAccounts, agentAccounts] = await Promise.all([
      rpc.getProgramAccounts(REPUTATION_ORACLE_PROGRAM_ADDRESS, {
        encoding: 'base64',
        filters: [{ memcmp: { offset: 0n, bytes: asBase64(SKILL_LISTING_DISCRIMINATOR), encoding: 'base64' } }],
      }).send(),
      rpc.getProgramAccounts(REPUTATION_ORACLE_PROGRAM_ADDRESS, {
        encoding: 'base64',
        filters: [{ memcmp: { offset: 0n, bytes: asBase64(AGENT_PROFILE_DISCRIMINATOR), encoding: 'base64' } }],
      }).send(),
    ]);

    const skillDecoder = getSkillListingDecoder();
    const agentDecoder = getAgentProfileDecoder();

    const skills = skillAccounts.map((a) => {
      const data = skillDecoder.decode(new Uint8Array(Buffer.from(a.account.data[0], 'base64')));
      return {
        publicKey: a.pubkey,
        account: {
          author: data.author,
          name: data.name,
          description: data.description,
          priceLamports: Number(data.priceLamports),
          totalDownloads: Number(data.totalDownloads),
          totalRevenue: Number(data.totalRevenue),
          status: data.status,
        },
      };
    });

    const agents = agentAccounts.map((a) => {
      const data = agentDecoder.decode(new Uint8Array(Buffer.from(a.account.data[0], 'base64')));
      return {
        publicKey: a.pubkey,
        account: {
          authority: data.authority,
          totalStakedFor: Number(data.totalStakedFor),
        },
      };
    });

    const authorPubkeys = [...new Set(skills.map((s) => s.account.author))];
    const registeredWallets = new Set(agents.map((a) => a.account.authority));
    let identityMap = new Map();
    try {
      identityMap = await resolveManyAgentIdentitiesByWallet(authorPubkeys, {
        hasAgentProfileByWallet: new Map(
          authorPubkeys.map((authorPubkey) => [authorPubkey, registeredWallets.has(authorPubkey)])
        ),
      });
    } catch (error) {
      console.error('Failed to resolve author identities for /api/landing:', error);
    }
    const authorSet = new Set(
      authorPubkeys.map((authorPubkey) => identityMap.get(authorPubkey)?.canonicalAgentId ?? authorPubkey)
    );
    const totalRevenue = skills.reduce((sum, s) => sum + s.account.totalRevenue, 0);
    const totalStaked = agents.reduce((sum, a) => sum + a.account.totalStakedFor, 0);
    const onChainDownloads = skills.reduce((sum, s) => sum + s.account.totalDownloads, 0);

    const featuredSkills = [...skills]
      .filter((s) => {
        const st = s.account.status as any;
        return st?.active !== undefined || st?.Active !== undefined || !st;
      })
      .sort((a, b) => b.account.totalDownloads - a.account.totalDownloads)
      .slice(0, 3)
      .map((skill) => ({
        ...skill,
        authorIdentity: identityMap.get(skill.account.author) ?? null,
      }));

    return NextResponse.json(
      {
        metrics: {
          agents: agents.length,
          authors: authorSet.size,
          skills: skills.length,
          revenue: totalRevenue,
          staked: totalStaked,
          onChainDownloads,
        },
        featuredSkills,
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
        },
      }
    );
  } catch (error: any) {
    console.error('GET /api/landing error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
