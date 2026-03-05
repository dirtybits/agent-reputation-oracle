import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { createSolanaRpc } from '@solana/kit';
import type { Base64EncodedBytes } from '@solana/rpc-types';
import {
  getSkillListingDecoder,
  SKILL_LISTING_DISCRIMINATOR,
} from '../../../../../generated/reputation-oracle/src/generated';
import { REPUTATION_ORACLE_PROGRAM_ADDRESS } from '../../../../../generated/reputation-oracle/src/generated/programs';
import {
  generatePaymentRequirement,
  verifyPaymentProof,
  settlePayment,
  type PaymentProof,
} from '@/lib/x402';

const rpc = createSolanaRpc(process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com');
const asBase64 = (bytes: Uint8Array) =>
  Buffer.from(bytes).toString('base64') as Base64EncodedBytes;

async function getOnChainPrice(onChainAddress: string): Promise<{ price: number; author: string } | null> {
  try {
    const accounts = await rpc.getProgramAccounts(REPUTATION_ORACLE_PROGRAM_ADDRESS, {
      encoding: 'base64',
      filters: [
        { memcmp: { offset: 0n, bytes: asBase64(SKILL_LISTING_DISCRIMINATOR), encoding: 'base64' } },
      ],
    }).send();
    const decoder = getSkillListingDecoder();
    for (const a of accounts) {
      if (a.pubkey !== onChainAddress) continue;
      const data = decoder.decode(new Uint8Array(Buffer.from(a.account.data[0], 'base64')));
      return { price: Number(data.priceLamports), author: data.author as string };
    }
  } catch { /* best effort */ }
  return null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const rows = await sql()`
      SELECT s.id, s.on_chain_address, s.author_pubkey, s.skill_id, sv.content
      FROM skill_versions sv
      JOIN skills s ON s.id = sv.skill_id
      WHERE s.id = ${id}::uuid
      ORDER BY sv.version DESC
      LIMIT 1
    `;

    if (rows.length === 0) {
      return new NextResponse('Skill not found', { status: 404 });
    }

    const skill = rows[0];
    const paymentProofHeader = request.headers.get('x-payment-proof');

    if (skill.on_chain_address) {
      const listing = await getOnChainPrice(skill.on_chain_address);
      if (listing && listing.price > 0) {
        if (paymentProofHeader) {
          try {
            const proof: PaymentProof = JSON.parse(paymentProofHeader);
            const verification = await verifyPaymentProof(proof);
            if (verification.status === 'valid') {
              await settlePayment(proof);
              await sql()`
                UPDATE skills SET total_installs = total_installs + 1 WHERE id = ${id}::uuid
              `;
              return new NextResponse(skill.content, {
                headers: {
                  'Content-Type': 'text/markdown; charset=utf-8',
                  'Content-Disposition': 'attachment; filename="SKILL.md"',
                },
              });
            }
            return NextResponse.json(
              { error: 'Payment verification failed', detail: verification.error },
              { status: 402, headers: { 'X-Payment-Status': verification.status } }
            );
          } catch {
            return NextResponse.json(
              { error: 'Invalid X-Payment-Proof header' },
              { status: 400 }
            );
          }
        }

        const requirement = generatePaymentRequirement({
          skillId: skill.skill_id,
          priceLamports: listing.price,
          authorPubkey: listing.author,
          resourcePath: `/api/skills/${id}/raw`,
        });

        return NextResponse.json(
          {
            error: 'Payment required',
            message: `This skill costs ${(listing.price / 1e9).toFixed(4)} SOL. Submit payment proof in the X-Payment-Proof header.`,
            requirement,
          },
          {
            status: 402,
            headers: {
              'X-Payment': JSON.stringify(requirement),
            },
          }
        );
      }
    }

    await sql()`
      UPDATE skills SET total_installs = total_installs + 1 WHERE id = ${id}::uuid
    `;

    return new NextResponse(skill.content, {
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Content-Disposition': 'attachment; filename="SKILL.md"',
      },
    });
  } catch (error: any) {
    console.error('GET /api/skills/[id]/raw error:', error);
    return new NextResponse('Internal server error', { status: 500 });
  }
}
