import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { verifyAuthorTrust, resolveMultipleAuthorTrust } from '@/lib/trust';
import { verifyWalletSignature, type AuthPayload } from '@/lib/auth';
import { pinSkillContent } from '@/lib/ipfs';
import {
  getConfiguredSolanaChainContext,
  normalizeInputChainContext,
  normalizePersistedChainContext,
} from '@/lib/chains';
import { createSolanaRpc } from '@solana/kit';
import type { Base64EncodedBytes } from '@solana/rpc-types';
import {
  getSkillListingDecoder,
  SKILL_LISTING_DISCRIMINATOR,
} from '../../../generated/reputation-oracle/src/generated';
import { REPUTATION_ORACLE_PROGRAM_ADDRESS } from '../../../generated/reputation-oracle/src/generated/programs';

const PAGE_SIZE = 20;
const rpc = createSolanaRpc(process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com');
const configuredSolanaChainContext = getConfiguredSolanaChainContext();
const asBase64 = (bytes: Uint8Array) =>
  Buffer.from(bytes).toString('base64') as Base64EncodedBytes;

async function fetchOnChainListings(): Promise<any[]> {
  try {
    const accounts = await rpc.getProgramAccounts(REPUTATION_ORACLE_PROGRAM_ADDRESS, {
      encoding: 'base64',
      filters: [{ memcmp: { offset: 0n, bytes: asBase64(SKILL_LISTING_DISCRIMINATOR), encoding: 'base64' } }],
    }).send();
    const decoder = getSkillListingDecoder();
    return accounts
      .map((a) => {
        const data = decoder.decode(new Uint8Array(Buffer.from(a.account.data[0], 'base64')));
        return { pubkey: a.pubkey, data };
      })
      .map((l) => ({
        id: `chain-${l.pubkey}`,
        skill_id: l.pubkey,
        author_pubkey: l.data.author,
        name: l.data.name,
        description: l.data.description,
        tags: [],
        current_version: 1,
        ipfs_cid: null,
        on_chain_address: l.pubkey,
        skill_uri: l.data.skillUri || null,
        chain_context: configuredSolanaChainContext,
        total_installs: 0,
        total_downloads: Number(l.data.totalDownloads),
        price_lamports: Number(l.data.priceLamports),
        total_revenue: Number(l.data.totalRevenue),
        created_at: new Date(Number(l.data.createdAt) * 1000).toISOString(),
        updated_at: new Date(Number(l.data.updatedAt) * 1000).toISOString(),
        source: 'chain' as const,
      }));
  } catch (err) {
    console.error('Failed to fetch on-chain listings:', err);
    return [];
  }
}

function mergeSkills(pgSkills: any[], chainSkills: any[]): any[] {
  const merged = pgSkills.map(s => ({ ...s, source: 'repo' }));

  for (const chain of chainSkills) {
    // Only merge into a PG skill if the on_chain_address already recorded there matches.
    // Two separate on-chain listings (different pubkeys) are always kept as separate cards.
    const existing = merged.find(
      s => s.source === 'repo' && s.on_chain_address === chain.on_chain_address
    );
    if (existing) {
      existing.price_lamports = chain.price_lamports;
      existing.total_downloads = chain.total_downloads;
      existing.total_revenue = chain.total_revenue;
      existing.skill_uri = chain.skill_uri;
    } else {
      merged.push(chain);
    }
  }

  return merged;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const q = searchParams.get('q');
    const sort = searchParams.get('sort') || 'newest';
    const author = searchParams.get('author');
    const tags = searchParams.get('tags');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));

    let pgSkills: any[] = [];
    try {
      if (q) {
        pgSkills = await sql()`
          SELECT *
          FROM skills
          WHERE to_tsvector('english', name || ' ' || COALESCE(description, '')) @@ plainto_tsquery('english', ${q})
          ${author ? sql()`AND author_pubkey = ${author}` : sql()``}
          ${tags ? sql()`AND tags && ${tags.split(',').filter(Boolean)}::text[]` : sql()``}
        `;
      } else {
        pgSkills = await sql()`
          SELECT *
          FROM skills
          WHERE 1=1
          ${author ? sql()`AND author_pubkey = ${author}` : sql()``}
          ${tags ? sql()`AND tags && ${tags.split(',').filter(Boolean)}::text[]` : sql()``}
        `;
      }
    } catch {
      pgSkills = [];
    }

    pgSkills = pgSkills.map((skill) => ({
      ...skill,
      chain_context: normalizePersistedChainContext(skill.chain_context),
    }));

    const chainSkills = tags ? [] : await fetchOnChainListings();

    let allSkills = mergeSkills(pgSkills, chainSkills);

    if (author) {
      allSkills = allSkills.filter(s => s.author_pubkey === author);
    }
    if (q) {
      const lower = q.toLowerCase();
      allSkills = allSkills.filter(s =>
        s.source === 'repo' ||
        s.name.toLowerCase().includes(lower) ||
        (s.description || '').toLowerCase().includes(lower)
      );
    }

    const authorPubkeys = [...new Set(allSkills.map(s => s.author_pubkey))];
    const trustMap = authorPubkeys.length > 0
      ? await resolveMultipleAuthorTrust(authorPubkeys)
      : new Map();

    const enriched = allSkills.map(skill => ({
      ...skill,
      author_trust: trustMap.get(skill.author_pubkey) || null,
    }));

    if (sort === 'trusted') {
      enriched.sort((a, b) =>
        (b.author_trust?.reputationScore ?? 0) - (a.author_trust?.reputationScore ?? 0)
      );
    } else if (sort === 'installs') {
      enriched.sort((a, b) =>
        (b.total_installs + (b.total_downloads ?? 0)) - (a.total_installs + (a.total_downloads ?? 0))
      );
    } else if (sort === 'name') {
      enriched.sort((a, b) => a.name.localeCompare(b.name));
    } else {
      enriched.sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    }

    const total = enriched.length;
    const offset = (page - 1) * PAGE_SIZE;
    const paged = enriched.slice(offset, offset + PAGE_SIZE);

    return NextResponse.json({
      skills: paged,
      pagination: {
        page,
        pageSize: PAGE_SIZE,
        total,
        totalPages: Math.ceil(total / PAGE_SIZE),
      },
    });
  } catch (error: any) {
    console.error('GET /api/skills error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { auth, skill_id, name, description, tags, content, contact } = body as {
      auth: AuthPayload;
      skill_id: string;
      name: string;
      description?: string;
      tags?: string[];
      content: string;
      contact?: string;
      chain_context?: string;
    };

    if (!auth || !skill_id || !name || !content) {
      return NextResponse.json(
        { error: 'Missing required fields: auth, skill_id, name, content' },
        { status: 400 }
      );
    }

    const verification = verifyWalletSignature(auth);
    if (!verification.valid) {
      return NextResponse.json(
        { error: verification.error || 'Invalid signature' },
        { status: 401 }
      );
    }

    const authorPubkey = verification.pubkey!;
    const normalizedChainContext = body.chain_context
      ? normalizeInputChainContext(body.chain_context)
      : configuredSolanaChainContext;

    if (body.chain_context && !normalizedChainContext) {
      return NextResponse.json(
        { error: 'Invalid chain_context. Use a supported CAIP-2 value or known alias.' },
        { status: 400 }
      );
    }

    let trust;
    try {
      trust = await verifyAuthorTrust(authorPubkey);
    } catch {
      return NextResponse.json(
        { error: 'Unable to verify on-chain registration. Please try again.' },
        { status: 503 }
      );
    }

    if (!trust.isRegistered) {
      return NextResponse.json(
        { error: 'You must register an on-chain AgentProfile before publishing. Go to your Profile tab to register.' },
        { status: 403 }
      );
    }

    const pinResult = await pinSkillContent(content, skill_id, 1);

    const [skill] = await sql()`
      INSERT INTO skills (skill_id, author_pubkey, name, description, tags, current_version, ipfs_cid, contact, chain_context)
      VALUES (
        ${skill_id},
        ${authorPubkey},
        ${name},
        ${description || null},
        ${tags || []}::text[],
        1,
        ${pinResult.success ? pinResult.cid : null},
        ${contact || null},
        ${normalizedChainContext}
      )
      RETURNING *
    `;

    await sql()`
      INSERT INTO skill_versions (skill_id, version, content, ipfs_cid, changelog)
      VALUES (
        ${skill.id}::uuid,
        1,
        ${content},
        ${pinResult.success ? pinResult.cid : null},
        'Initial release'
      )
    `;

    return NextResponse.json({
      ...skill,
      ipfs: pinResult,
    }, { status: 201 });
  } catch (error: any) {
    console.error('POST /api/skills error:', error);
    if (error.message?.includes('unique')) {
      return NextResponse.json(
        { error: 'A skill with this ID already exists for your account' },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
