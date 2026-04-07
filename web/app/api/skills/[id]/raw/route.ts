import { NextRequest, NextResponse } from "next/server";
import { normalizeProtocolNewlines } from "@agentvouch/protocol";
import { sql } from "@/lib/db";
import { getOnChainPrice } from "@/lib/onchain";
import {
  verifyWalletSignature,
  buildDownloadRawMessage,
  type AuthPayload,
} from "@/lib/auth";
import { generatePaymentRequirement, hasOnChainPurchase } from "@/lib/x402";
import { getErrorMessage } from "@/lib/errors";

type RawSkillContentRow = {
  id: string;
  on_chain_address: string | null;
  author_pubkey: string;
  skill_id: string;
  content: string;
};

function serveContent(content: string) {
  return new NextResponse(content, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": 'attachment; filename="SKILL.md"',
    },
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const rows = await sql()<RawSkillContentRow>`
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

    if (skill.on_chain_address) {
      const listing = await getOnChainPrice(skill.on_chain_address);
      if (listing && listing.price > 0) {
        const authHeader = request.headers.get("x-agentvouch-auth");

        if (authHeader) {
          let auth: AuthPayload;
          try {
            auth = JSON.parse(authHeader);
          } catch {
            return NextResponse.json(
              { error: "Malformed X-AgentVouch-Auth header (invalid JSON)" },
              { status: 400 }
            );
          }

          const verification = verifyWalletSignature(auth);
          if (!verification.valid || !verification.pubkey) {
            return NextResponse.json(
              { error: verification.error || "Invalid signature" },
              { status: 401 }
            );
          }

          const expectedMessage = buildDownloadRawMessage(
            id,
            skill.on_chain_address,
            auth.timestamp
          );
          if (normalizeProtocolNewlines(auth.message) !== expectedMessage) {
            return NextResponse.json(
              {
                error: "Message scope mismatch",
                expected_format:
                  "AgentVouch Skill Download\\nAction: download-raw\\nSkill id: {id}\\nListing: {listing}\\nTimestamp: {ms}",
              },
              { status: 401 }
            );
          }

          const purchased = await hasOnChainPurchase(
            verification.pubkey,
            skill.on_chain_address
          ).catch(() => false);

          if (!purchased) {
            const requirement = generatePaymentRequirement({
              skillId: skill.skill_id,
              priceLamports: listing.price,
              skillListingAddress: skill.on_chain_address,
              resourcePath: `/api/skills/${id}/raw`,
            });
            return NextResponse.json(
              {
                error: "Purchase not found on-chain for this wallet",
                requirement,
              },
              {
                status: 402,
                headers: { "X-Payment": JSON.stringify(requirement) },
              }
            );
          }

          await sql()`
            UPDATE skills SET total_installs = total_installs + 1 WHERE id = ${id}::uuid
          `;
          return serveContent(skill.content);
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
            )} SOL. Call purchaseSkill on-chain, then retry with X-AgentVouch-Auth header. See https://agentvouch.xyz/docs#paid-skill-download for the signed message format.`,
            requirement,
          },
          {
            status: 402,
            headers: { "X-Payment": JSON.stringify(requirement) },
          }
        );
      }
    }

    await sql()`
      UPDATE skills SET total_installs = total_installs + 1 WHERE id = ${id}::uuid
    `;

    return serveContent(skill.content);
  } catch (error: unknown) {
    console.error("GET /api/skills/[id]/raw error:", error);
    return new NextResponse(getErrorMessage(error, "Internal server error"), {
      status: 500,
    });
  }
}
