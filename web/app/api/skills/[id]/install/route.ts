import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { verifyWalletSignature, type AuthPayload } from '@/lib/auth';
import { createSolanaRpc } from '@solana/kit';
import type { Base64EncodedBytes } from '@solana/rpc-types';
import {
  getSkillListingDecoder,
  SKILL_LISTING_DISCRIMINATOR,
} from '../../../../../generated/reputation-oracle/src/generated';
import { REPUTATION_ORACLE_PROGRAM_ADDRESS } from '../../../../../generated/reputation-oracle/src/generated/programs';

const rpc = createSolanaRpc(process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com');
const asBase64 = (bytes: Uint8Array) =>
  Buffer.from(bytes).toString('base64') as Base64EncodedBytes;

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
      try {
        const accounts = await rpc.getProgramAccounts(REPUTATION_ORACLE_PROGRAM_ADDRESS, {
          encoding: 'base64',
          filters: [
            { memcmp: { offset: 0n, bytes: asBase64(SKILL_LISTING_DISCRIMINATOR), encoding: 'base64' } },
          ],
        }).send();
        const decoder = getSkillListingDecoder();
        for (const a of accounts) {
          if (a.pubkey !== skill.on_chain_address) continue;
          const data = decoder.decode(new Uint8Array(Buffer.from(a.account.data[0], 'base64')));
          if (Number(data.priceLamports) > 0) {
            return NextResponse.json(
              { error: 'Paid skills require an on-chain purchase' },
              { status: 402 }
            );
          }
          break;
        }
      } catch {
        // If we can't verify the price, allow the install
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
