import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { resolveAuthorTrust } from '@/lib/trust';

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
      SELECT id, version, ipfs_cid, changelog, created_at
      FROM skill_versions
      WHERE skill_id = ${id}::uuid
      ORDER BY version DESC
    `;

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

    return NextResponse.json({
      ...skill,
      versions,
      author_trust,
      content_verification,
    });
  } catch (error: any) {
    console.error('GET /api/skills/[id] error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
