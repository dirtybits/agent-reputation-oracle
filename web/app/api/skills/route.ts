import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { resolveMultipleAuthorTrust, getReadOnlyProgram } from '@/lib/trust';
import { verifyWalletSignature, type AuthPayload } from '@/lib/auth';
import { pinSkillContent } from '@/lib/ipfs';

const PAGE_SIZE = 20;

const toNum = (v: any) => v?.toNumber?.() ?? v ?? 0;

async function fetchOnChainListings(): Promise<any[]> {
  try {
    const program = getReadOnlyProgram();
    const listings = await (program.account as any).skillListing.all();
    return listings
      .filter((l: any) => l.account.status?.active !== undefined)
      .map((l: any) => ({
        id: `chain-${l.publicKey.toBase58()}`,
        skill_id: l.publicKey.toBase58(),
        author_pubkey: l.account.author.toBase58(),
        name: l.account.name,
        description: l.account.description,
        tags: [],
        current_version: 1,
        ipfs_cid: null,
        on_chain_address: l.publicKey.toBase58(),
        chain_context: 'solana',
        total_installs: 0,
        total_downloads: toNum(l.account.totalDownloads),
        price_lamports: toNum(l.account.priceLamports),
        total_revenue: toNum(l.account.totalRevenue),
        created_at: new Date(toNum(l.account.createdAt) * 1000).toISOString(),
        updated_at: new Date(toNum(l.account.updatedAt) * 1000).toISOString(),
        source: 'chain' as const,
      }));
  } catch (err) {
    console.error('Failed to fetch on-chain listings:', err);
    return [];
  }
}

function mergeSkills(pgSkills: any[], chainSkills: any[]): any[] {
  const merged = pgSkills.map(s => ({ ...s, source: 'repo' }));

  const pgKeys = new Set(
    pgSkills.map(s => `${s.author_pubkey}::${s.name.toLowerCase()}`)
  );

  for (const chain of chainSkills) {
    const key = `${chain.author_pubkey}::${chain.name.toLowerCase()}`;
    const existing = merged.find(
      s => `${s.author_pubkey}::${s.name.toLowerCase()}` === key
    );
    if (existing) {
      existing.price_lamports = chain.price_lamports;
      existing.on_chain_address = chain.on_chain_address;
      existing.total_downloads = chain.total_downloads;
      existing.total_revenue = chain.total_revenue;
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
    const { auth, skill_id, name, description, tags, content } = body as {
      auth: AuthPayload;
      skill_id: string;
      name: string;
      description?: string;
      tags?: string[];
      content: string;
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

    const pinResult = await pinSkillContent(content, skill_id, 1);

    const [skill] = await sql()`
      INSERT INTO skills (skill_id, author_pubkey, name, description, tags, current_version, ipfs_cid)
      VALUES (
        ${skill_id},
        ${authorPubkey},
        ${name},
        ${description || null},
        ${tags || []}::text[],
        1,
        ${pinResult.success ? pinResult.cid : null}
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
