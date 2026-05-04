import { NextRequest, NextResponse } from "next/server";
import { initializeDatabase, sql } from "@/lib/db";
import {
  verifyAndRecordDirectPurchase,
  type DirectPurchaseSkillRow,
} from "@/lib/directPurchaseVerification";

type VerifyPurchaseBody = {
  signature?: unknown;
  buyer?: unknown;
  listing?: unknown;
  listingAddress?: unknown;
};

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function logVerificationFailure(input: {
  reason: string;
  skillId: string;
  signature?: string | null;
  buyer?: string | null;
  listing?: string | null;
}) {
  console.warn(
    `[purchase-verify] failed reason=${input.reason} skill=${input.skillId} listing=${input.listing ?? "unknown"} buyer=${input.buyer ?? "unknown"} tx=${input.signature ?? "unknown"}`
  );
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await initializeDatabase();

  let body: VerifyPurchaseBody;
  try {
    body = (await request.json()) as VerifyPurchaseBody;
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON" },
      { status: 400 }
    );
  }

  const signature = stringOrNull(body.signature);
  const buyer = stringOrNull(body.buyer);
  const listing = stringOrNull(body.listingAddress) ?? stringOrNull(body.listing);

  if (!signature) {
    return NextResponse.json(
      { error: "Missing transaction signature" },
      { status: 400 }
    );
  }

  const rows = await sql()<DirectPurchaseSkillRow>`
    SELECT
      id,
      on_chain_address,
      author_pubkey,
      price_usdc_micros::text,
      currency_mint,
      chain_context,
      on_chain_protocol_version,
      on_chain_program_id
    FROM skills
    WHERE id = ${id}::uuid
    LIMIT 1
  `;
  const skill = rows[0];

  if (!skill) {
    return NextResponse.json({ error: "Skill not found" }, { status: 404 });
  }

  try {
    const verification = await verifyAndRecordDirectPurchase({
      skill,
      signature,
      buyerPubkey: buyer,
      listingAddress: listing,
    });

    return NextResponse.json({
      ok: true,
      entitlement: {
        skill_id: skill.id,
        buyer_pubkey: verification.buyerPubkey,
        payment_tx_signature: verification.signature,
        purchase_pda: verification.purchasePda,
        on_chain_address: verification.listingAddress,
        amount_micros: verification.amountMicros,
        currency_mint: verification.currencyMint,
        payment_flow: verification.paymentFlow,
        protocol_version: verification.protocolVersion,
        on_chain_program_id: verification.onChainProgramId,
        chain_context: verification.chainContext,
      },
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Purchase verification failed";
    logVerificationFailure({
      reason: message,
      skillId: skill.id,
      signature,
      buyer,
      listing: listing ?? skill.on_chain_address,
    });

    const status = /already recorded/i.test(message) ? 409 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
