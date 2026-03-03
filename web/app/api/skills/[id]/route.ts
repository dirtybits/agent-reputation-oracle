import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { resolveAuthorTrust } from '@/lib/trust';
import { verifyWalletSignature, type AuthPayload } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = request.nextUrl;
    const includeTrust = searchParams.get('include') !== 'none';

    const rows = await sql()`
      SELECT * FROM skills WHERE id = ${id}::uuid
    `;

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Skill not found' }, { status: 404 });
    }

    const skill = rows[0];

    const versions = await sql()`
      SELECT id, version, content, ipfs_cid, changelog, created_at
      FROM skill_versions
      WHERE skill_id = ${id}::uuid
      ORDER BY version DESC
    `;

    const latestContent = versions[0]?.content ?? null;

    let author_trust = null;
    if (includeTrust) {
      author_trust = await resolveAuthorTrust(skill.author_pubkey);
    }

    // Content verification: check if all versions have IPFS CIDs
    // and whether the current version CID matches the skill-level CID
    const latestVersion = versions[0];
    const allPinned = versions.every((v: any) => !!v.ipfs_cid);
    const currentCidMatch = latestVersion?.ipfs_cid === skill.ipfs_cid;
    const content_verification = {
      has_ipfs: !!skill.ipfs_cid,
      all_versions_pinned: allPinned,
      current_cid_consistent: currentCidMatch,
      status: !skill.ipfs_cid
        ? 'unverified'
        : allPinned && currentCidMatch
        ? 'verified'
        : 'drift_detected',
    };

    const versionsWithoutContent = versions.map(({ content, ...rest }: any) => rest);

    return NextResponse.json({
      ...skill,
      content: latestContent,
      versions: versionsWithoutContent,
      author_trust,
      content_verification,
    });
  } catch (error: any) {
    console.error('GET /api/skills/[id] error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { auth, on_chain_address } = body as {
      auth: AuthPayload;
      on_chain_address: string;
    };

    if (!auth || !on_chain_address) {
      return NextResponse.json(
        { error: 'Missing required fields: auth, on_chain_address' },
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

    const rows = await sql()`
      SELECT id, author_pubkey FROM skills WHERE id = ${id}::uuid
    `;
    if (rows.length === 0) {
      return NextResponse.json({ error: 'Skill not found' }, { status: 404 });
    }
    if (rows[0].author_pubkey !== verification.pubkey) {
      return NextResponse.json({ error: 'Not the skill author' }, { status: 403 });
    }

    const [updated] = await sql()`
      UPDATE skills
      SET on_chain_address = ${on_chain_address}, updated_at = NOW()
      WHERE id = ${id}::uuid
      RETURNING *
    `;

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error('PATCH /api/skills/[id] error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
