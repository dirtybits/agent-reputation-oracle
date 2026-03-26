import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getOnChainPrice } from "@/lib/onchain";
import {
  generatePaymentRequirement,
  verifyPaymentProof,
  type PaymentProof,
} from "@/lib/x402";

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
      return new NextResponse("Skill not found", { status: 404 });
    }

    const skill = rows[0];
    const paymentProofHeader = request.headers.get("x-payment-proof");

    if (skill.on_chain_address) {
      const listing = await getOnChainPrice(skill.on_chain_address);
      if (listing && listing.price > 0) {
        if (paymentProofHeader) {
          try {
            const proof: PaymentProof = JSON.parse(paymentProofHeader);
            const verification = await verifyPaymentProof(proof);
            if (verification.status === "valid") {
              await sql()`
                UPDATE skills SET total_installs = total_installs + 1 WHERE id = ${id}::uuid
              `;
              return new NextResponse(skill.content, {
                headers: {
                  "Content-Type": "text/markdown; charset=utf-8",
                  "Content-Disposition": 'attachment; filename="SKILL.md"',
                },
              });
            }
            return NextResponse.json(
              {
                error: "Payment verification failed",
                detail: verification.error,
              },
              {
                status: 402,
                headers: { "X-Payment-Status": verification.status },
              }
            );
          } catch {
            return NextResponse.json(
              { error: "Invalid X-Payment-Proof header" },
              { status: 400 }
            );
          }
        }

        const requirement = generatePaymentRequirement({
          skillId: skill.skill_id,
          priceLamports: listing.price,
          skillListingAddress: skill.on_chain_address,
          resourcePath: `/api/skills/${id}/raw`,
        });

        return NextResponse.json(
          {
            error: "Payment required",
            message: `This skill costs ${(listing.price / 1e9).toFixed(
              4
            )} SOL. Call purchaseSkill on-chain, then retry with X-Payment-Proof.`,
            requirement,
          },
          {
            status: 402,
            headers: {
              "X-Payment": JSON.stringify(requirement),
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
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": 'attachment; filename="SKILL.md"',
      },
    });
  } catch (error: any) {
    console.error("GET /api/skills/[id]/raw error:", error);
    return new NextResponse("Internal server error", { status: 500 });
  }
}
