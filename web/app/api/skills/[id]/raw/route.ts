import { NextRequest, NextResponse } from "next/server";
import {
  address,
  getAddressEncoder,
  getProgramDerivedAddress,
  type Address,
} from "@solana/kit";
import { initializeDatabase, sql } from "@/lib/db";
import { getOnChainPrice } from "@/lib/onchain";
import {
  verifyWalletSignature,
  buildDownloadRawMessage,
  normalizeProtocolNewlines,
  type AuthPayload,
} from "@/lib/auth";
import {
  buildX402PaymentRequiredBody,
  decodeX402PaymentSignatureHeader,
  encodeX402PaymentRequiredHeader,
  encodeX402PaymentResponseHeader,
  generatePaymentRequirement,
  generateX402UsdcRequirement,
  hasOnChainPurchase,
  settleX402Payment,
  verifySettledUsdcTransfer,
  verifyX402Payment,
  type X402PaymentRequiredBody,
  type X402SettleResponse,
} from "@/lib/x402";
import { getErrorMessage } from "@/lib/errors";
import {
  hasUsdcPurchaseEntitlement,
  recordUsdcPurchaseReceipt,
} from "@/lib/usdcPurchases";

type RawSkillContentRow = {
  id: string;
  on_chain_address: string | null;
  author_pubkey: string;
  skill_id: string;
  name: string;
  content: string;
  price_usdc_micros: string | null;
  currency_mint: string | null;
};

const TOKEN_PROGRAM_ID = address(
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
);
const ASSOCIATED_TOKEN_PROGRAM_ID = address(
  "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
);

async function deriveAssociatedTokenAccount(
  owner: string,
  mint: string
): Promise<string> {
  const addressEncoder = getAddressEncoder();
  const [ata] = await getProgramDerivedAddress({
    programAddress: ASSOCIATED_TOKEN_PROGRAM_ID,
    seeds: [
      addressEncoder.encode(owner as Address),
      addressEncoder.encode(TOKEN_PROGRAM_ID),
      addressEncoder.encode(mint as Address),
    ],
  });
  return ata.toString();
}

function serveContent(content: string, extraHeaders?: Record<string, string>) {
  return new NextResponse(content, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": 'attachment; filename="SKILL.md"',
      ...(extraHeaders ?? {}),
    },
  });
}

async function incrementInstalls(skillDbId: string) {
  await sql()`
    UPDATE skills SET total_installs = total_installs + 1 WHERE id = ${skillDbId}::uuid
  `;
}

function getResourceInfo(request: NextRequest, skillName: string) {
  const resourceUrl = new URL(request.url);
  resourceUrl.search = "";
  return {
    url: resourceUrl.toString(),
    description: `AgentVouch skill: ${skillName}`,
    mimeType: "text/markdown; charset=utf-8",
  };
}

function paymentRequired402(body: X402PaymentRequiredBody) {
  return NextResponse.json(body, {
    status: 402,
    headers: {
      "Content-Type": "application/json",
      "PAYMENT-REQUIRED": encodeX402PaymentRequiredHeader(body),
    },
  });
}

function buildPaymentResponseHeaders(value: X402SettleResponse) {
  const encoded = encodeX402PaymentResponseHeader(value);
  return {
    "PAYMENT-RESPONSE": encoded,
    "X-PAYMENT-RESPONSE": encoded,
  };
}

function validateDownloadAuth(
  authHeader: string,
  skillDbId: string,
  listingAddress: string
): { buyerPubkey: string } | { response: NextResponse } {
  let auth: AuthPayload;
  try {
    auth = JSON.parse(authHeader);
  } catch {
    return {
      response: NextResponse.json(
        { error: "Malformed X-AgentVouch-Auth header (invalid JSON)" },
        { status: 400 }
      ),
    };
  }

  const verification = verifyWalletSignature(auth);
  if (!verification.valid || !verification.pubkey) {
    return {
      response: NextResponse.json(
        { error: verification.error || "Invalid signature" },
        { status: 401 }
      ),
    };
  }

  const expectedMessage = buildDownloadRawMessage(
    skillDbId,
    listingAddress,
    auth.timestamp
  );
  if (normalizeProtocolNewlines(auth.message) !== expectedMessage) {
    return {
      response: NextResponse.json(
        {
          error: "Message scope mismatch",
          expected_format:
            "AgentVouch Skill Download\\nAction: download-raw\\nSkill id: {id}\\nListing: {listing}\\nTimestamp: {ms}",
        },
        { status: 401 }
      ),
    };
  }

  return { buyerPubkey: verification.pubkey };
}

async function handleUsdcDirect(
  request: NextRequest,
  skillDbId: string,
  skill: RawSkillContentRow
) {
  if (!skill.currency_mint || !skill.price_usdc_micros) {
    return NextResponse.json(
      { error: "USDC listing is missing currency mint or price" },
      { status: 500 }
    );
  }

  let priceMicros: bigint;
  try {
    priceMicros = BigInt(skill.price_usdc_micros);
  } catch {
    return NextResponse.json(
      { error: "USDC listing has invalid price_usdc_micros" },
      { status: 500 }
    );
  }

  if (priceMicros <= 0n) {
    return NextResponse.json(
      { error: "USDC listing has invalid price_usdc_micros" },
      { status: 500 }
    );
  }

  const authorUsdcAta = await deriveAssociatedTokenAccount(
    skill.author_pubkey,
    skill.currency_mint
  );
  const requirement = await generateX402UsdcRequirement({
    priceUsdcMicros: priceMicros,
    payTo: skill.author_pubkey,
    usdcMint: skill.currency_mint,
    extra: {
      agentvouch_skill_id: skill.skill_id,
      agentvouch_skill_db_id: skillDbId,
    },
  });
  const paymentRequired = buildX402PaymentRequiredBody({
    error: "Payment required",
    resource: getResourceInfo(request, skill.name),
    requirement,
  });

  const authHeader = request.headers.get("x-agentvouch-auth");
  if (authHeader) {
    if (!skill.on_chain_address) {
      return NextResponse.json(
        { error: "USDC entitlements require a linked on-chain listing" },
        { status: 500 }
      );
    }

    const authResult = validateDownloadAuth(
      authHeader,
      skillDbId,
      skill.on_chain_address
    );
    if ("response" in authResult) {
      return authResult.response;
    }

    const entitled = await hasUsdcPurchaseEntitlement(
      skillDbId,
      authResult.buyerPubkey
    ).catch(() => false);
    if (entitled) {
      await incrementInstalls(skillDbId);
      return serveContent(skill.content);
    }

    paymentRequired.error = "USDC purchase not found for this wallet";
  }

  const paymentHeader = request.headers.get("payment-signature");
  if (!paymentHeader) {
    return paymentRequired402(paymentRequired);
  }

  const payload = decodeX402PaymentSignatureHeader(paymentHeader);
  if (!payload) {
    return paymentRequired402({
      ...paymentRequired,
      error: "Malformed PAYMENT-SIGNATURE header",
    });
  }

  try {
    const verify = await verifyX402Payment(payload, requirement);
    if (!verify.isValid) {
      return paymentRequired402({
        ...paymentRequired,
        error:
          verify.invalidMessage ||
          verify.invalidReason ||
          "Payment verification failed",
      });
    }

    const settle = await settleX402Payment(payload, requirement);
    if (!settle.success) {
      return paymentRequired402({
        ...paymentRequired,
        error:
          settle.errorMessage ||
          settle.errorReason ||
          "Payment settlement failed",
      });
    }

    const payer = settle.payer || verify.payer;
    if (!payer) {
      return paymentRequired402({
        ...paymentRequired,
        error: "Facilitator did not return the payer wallet",
      });
    }

    const transferCheck = await verifySettledUsdcTransfer({
      signature: settle.transaction,
      destinationAta: authorUsdcAta,
      currencyMint: skill.currency_mint,
      minimumAmountMicros: priceMicros,
    });

    await recordUsdcPurchaseReceipt({
      skillDbId,
      buyerPubkey: payer,
      paymentTxSignature: settle.transaction,
      recipientAta: authorUsdcAta,
      currencyMint: skill.currency_mint,
      amountMicros: transferCheck.settledAmountMicros.toString(),
    });

    console.info(
      `[x402] settled direct USDC purchase: skill=${skillDbId} tx=${settle.transaction} payer=${payer}`
    );

    await incrementInstalls(skillDbId);

    const settleResponse: X402SettleResponse = {
      success: true,
      transaction: settle.transaction,
      network: settle.network,
      payer,
      ...(settle.amount ? { amount: settle.amount } : {}),
      ...(settle.extensions ? { extensions: settle.extensions } : {}),
    };

    return serveContent(skill.content, buildPaymentResponseHeaders(settleResponse));
  } catch (error: unknown) {
    return paymentRequired402({
      ...paymentRequired,
      error: `Facilitator error: ${getErrorMessage(error)}`,
    });
  }
}

async function handleLegacySolGate(
  request: NextRequest,
  skillDbId: string,
  skill: RawSkillContentRow
) {
  if (!skill.on_chain_address) {
    await incrementInstalls(skillDbId);
    return serveContent(skill.content);
  }

  const listing = await getOnChainPrice(skill.on_chain_address);
  if (!listing || listing.price <= 0) {
    await incrementInstalls(skillDbId);
    return serveContent(skill.content);
  }

  const authHeader = request.headers.get("x-agentvouch-auth");

  if (authHeader) {
    const authResult = validateDownloadAuth(
      authHeader,
      skillDbId,
      skill.on_chain_address
    );
    if ("response" in authResult) {
      return authResult.response;
    }

    const purchased = await hasOnChainPurchase(
      authResult.buyerPubkey,
      skill.on_chain_address
    ).catch(() => false);

    if (!purchased) {
      const requirement = generatePaymentRequirement({
        skillId: skill.skill_id,
        priceLamports: listing.price,
        skillListingAddress: skill.on_chain_address,
        resourcePath: `/api/skills/${skillDbId}/raw`,
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

    await incrementInstalls(skillDbId);
    return serveContent(skill.content);
  }

  const requirement = generatePaymentRequirement({
    skillId: skill.skill_id,
    priceLamports: listing.price,
    skillListingAddress: skill.on_chain_address,
    resourcePath: `/api/skills/${skillDbId}/raw`,
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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await initializeDatabase();

    const rows = await sql()<RawSkillContentRow>`
      SELECT
        s.id,
        s.on_chain_address,
        s.author_pubkey,
        s.skill_id,
        s.name,
        s.price_usdc_micros,
        s.currency_mint,
        sv.content
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

    if (skill.price_usdc_micros && skill.currency_mint) {
      return handleUsdcDirect(request, id, skill);
    }

    return handleLegacySolGate(request, id, skill);
  } catch (error: unknown) {
    console.error("GET /api/skills/[id]/raw error:", error);
    return new NextResponse(getErrorMessage(error, "Internal server error"), {
      status: 500,
    });
  }
}
