import { NextRequest, NextResponse } from "next/server";
import { initializeDatabase, sql } from "@/lib/db";
import { verifyWalletSignature, type AuthPayload } from "@/lib/auth";
import { getOnChainPrice } from "@/lib/onchain";
import { hasOnChainPurchase } from "@/lib/x402";
import { getErrorMessage } from "@/lib/errors";
import { hasUsdcPurchaseEntitlement } from "@/lib/usdcPurchases";

const CHAIN_PREFIX = "chain-";

type InstallSkillRow = {
  id: string;
  on_chain_address: string | null;
  price_usdc_micros?: string | null;
  total_installs?: number;
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await initializeDatabase();
    const body = await request.json();
    const { auth } = body as { auth: AuthPayload };

    if (!auth) {
      return NextResponse.json(
        { error: "Missing auth payload" },
        { status: 400 }
      );
    }

    const verification = verifyWalletSignature(auth);
    if (!verification.valid) {
      return NextResponse.json(
        { error: verification.error || "Invalid signature" },
        { status: 401 }
      );
    }
    if (!verification.pubkey) {
      return NextResponse.json(
        { error: "Verified wallet pubkey is missing" },
        { status: 401 }
      );
    }

    if (id.startsWith(CHAIN_PREFIX)) {
      const pubkey = id.slice(CHAIN_PREFIX.length);
      const listing = await getOnChainPrice(pubkey);
      if (!listing) {
        return NextResponse.json(
          { error: "Skill not found on-chain" },
          { status: 404 }
        );
      }
      if (listing.price > 0) {
        const purchased = await hasOnChainPurchase(
          verification.pubkey,
          pubkey
        ).catch(() => false);
        if (purchased) {
          return NextResponse.json({
            success: true,
            skill_id: pubkey,
            installed_by: verification.pubkey,
          });
        }
        return NextResponse.json(
          { error: "Paid skills require an on-chain purchase" },
          { status: 402 }
        );
      }
      return NextResponse.json({
        success: true,
        skill_id: pubkey,
        installed_by: verification.pubkey,
      });
    }

    const rows = await sql()<InstallSkillRow>`
      SELECT id, on_chain_address, price_usdc_micros FROM skills
      WHERE id = ${id}::uuid
    `;

    if (rows.length === 0) {
      return NextResponse.json({ error: "Skill not found" }, { status: 404 });
    }

    const skill = rows[0];

    if (skill.price_usdc_micros) {
      const purchased = await hasUsdcPurchaseEntitlement(
        id,
        verification.pubkey
      ).catch(() => false);
      if (purchased) {
        const [updated] = await sql()<
          Required<Pick<InstallSkillRow, "id" | "total_installs">>
        >`
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
      }

      return NextResponse.json(
        { error: "Paid skills require a verified USDC purchase" },
        { status: 402 }
      );
    }

    if (skill.on_chain_address) {
      const listing = await getOnChainPrice(skill.on_chain_address);
      if (listing && listing.price > 0) {
        const purchased = await hasOnChainPurchase(
          verification.pubkey,
          skill.on_chain_address
        ).catch(() => false);
        if (purchased) {
          const [updated] = await sql()<
            Required<Pick<InstallSkillRow, "id" | "total_installs">>
          >`
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
        }
        return NextResponse.json(
          { error: "Paid skills require an on-chain purchase" },
          { status: 402 }
        );
      }
    }

    const [updated] = await sql()<
      Required<Pick<InstallSkillRow, "id" | "total_installs">>
    >`
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
  } catch (error: unknown) {
    console.error("POST /api/skills/[id]/install error:", error);
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 500 }
    );
  }
}
