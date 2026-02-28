import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { resolveMultipleAuthorTrust } from '@/lib/trust';
import { verifyWalletSignature, type AuthPayload } from '@/lib/auth';
import { pinSkillContent } from '@/lib/ipfs';

const PAGE_SIZE = 20;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const q = searchParams.get('q');
    const sort = searchParams.get('sort') || 'newest';
    const author = searchParams.get('author');
    const tags = searchParams.get('tags');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const offset = (page - 1) * PAGE_SIZE;

    let skills: any[];

    if (q) {
      skills = await sql()`
        SELECT *, ts_rank(to_tsvector('english', name || ' ' || COALESCE(description, '')), plainto_tsquery('english', ${q})) AS rank
        FROM skills
        WHERE to_tsvector('english', name || ' ' || COALESCE(description, '')) @@ plainto_tsquery('english', ${q})
        ${author ? sql()`AND author_pubkey = ${author}` : sql()``}
        ${tags ? sql()`AND tags && ${tags.split(',').filter(Boolean)}::text[]` : sql()``}
        ORDER BY rank DESC
        LIMIT ${PAGE_SIZE} OFFSET ${offset}
      `;
    } else {
      const orderClause =
        sort === 'installs' ? sql()`ORDER BY total_installs DESC` :
        sort === 'name'     ? sql()`ORDER BY name ASC` :
                              sql()`ORDER BY created_at DESC`;

      skills = await sql()`
        SELECT *
        FROM skills
        WHERE 1=1
        ${author ? sql()`AND author_pubkey = ${author}` : sql()``}
        ${tags ? sql()`AND tags && ${tags.split(',').filter(Boolean)}::text[]` : sql()``}
        ${orderClause}
        LIMIT ${PAGE_SIZE} OFFSET ${offset}
      `;
    }

    const countResult = await sql()`
      SELECT COUNT(*) as total FROM skills
      WHERE 1=1
      ${author ? sql()`AND author_pubkey = ${author}` : sql()``}
      ${tags ? sql()`AND tags && ${tags.split(',').filter(Boolean)}::text[]` : sql()``}
    `;
    const total = parseInt(countResult[0]?.total || '0');

    const authorPubkeys = [...new Set(skills.map(s => s.author_pubkey))];
    const trustMap = authorPubkeys.length > 0
      ? await resolveMultipleAuthorTrust(authorPubkeys)
      : new Map();

    const enriched = skills.map(skill => ({
      ...skill,
      author_trust: trustMap.get(skill.author_pubkey) || null,
    }));

    return NextResponse.json({
      skills: enriched,
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
