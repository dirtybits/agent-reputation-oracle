import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { verifyWalletSignature, type AuthPayload } from '@/lib/auth';
import { getOnChainPrice } from '@/lib/onchain';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { auth } = body as { auth: AuthPayload };

    if (!auth) {
      return NextResponse.json(
        { error: 'Missing auth payload' },
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
      SELECT id, on_chain_address FROM skills
      WHERE id = ${id}::uuid
    `;

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Skill not found' }, { status: 404 });
    }

    const skill = rows[0];

    if (skill.on_chain_address) {
      const listing = await getOnChainPrice(skill.on_chain_address);
      if (listing && listing.price > 0) {
        return NextResponse.json(
          { error: 'Paid skills require an on-chain purchase' },
          { status: 402 }
        );
      }
    }

    const [updated] = await sql()`
      UPDATE skills
      SET total_installs = total_installs + 1, updated_at = NOW()
      WHERE id = ${id}::uuid
      RETURNING id, total_installs
    `;

    return NextResponse.json({
      success: true,
      skill_id: updated.id,
      total_installs: updated.total_installs,
      installed_by: verification.pubkey,
    });
  } catch (error: any) {
    console.error('POST /api/skills/[id]/install error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
