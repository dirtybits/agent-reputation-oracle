import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/db", () => ({
  initializeDatabase: vi.fn().mockResolvedValue(undefined),
  sql: vi.fn(),
}));

const mockVerifyAndRecord = vi.fn();
vi.mock("@/lib/directPurchaseVerification", () => ({
  verifyAndRecordDirectPurchase: (...args: unknown[]) =>
    mockVerifyAndRecord(...args),
}));

import { POST } from "@/app/api/skills/[id]/purchase/verify/route";
import { sql } from "@/lib/db";

const mockSql = sql as unknown as ReturnType<typeof vi.fn>;

function makeRequest(body: unknown) {
  const req = new NextRequest(
    "http://localhost/api/skills/00000000-0000-0000-0000-000000000001/purchase/verify",
    {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    }
  );
  return {
    req,
    params: Promise.resolve({ id: "00000000-0000-0000-0000-000000000001" }),
  };
}

describe("POST /api/skills/[id]/purchase/verify", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("records direct purchase entitlements through the shared helper", async () => {
    const skill = {
      id: "00000000-0000-0000-0000-000000000001",
      on_chain_address: "Listing",
      author_pubkey: "Author",
      price_usdc_micros: "1000000",
      currency_mint: "Mint",
      chain_context: "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
      on_chain_protocol_version: "v0.2.0",
      on_chain_program_id: "Program",
    };
    mockSql.mockReturnValue(vi.fn().mockResolvedValue([skill]));
    mockVerifyAndRecord.mockResolvedValue({
      buyerPubkey: "Buyer",
      listingAddress: "Listing",
      purchasePda: "PurchasePDA",
      signature: "txsig",
      amountMicros: "1000000",
      currencyMint: "Mint",
      paymentFlow: "direct-purchase-skill",
      protocolVersion: "v0.2.0",
      onChainProgramId: "Program",
      chainContext: "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
    });

    const { req, params } = makeRequest({
      signature: "txsig",
      buyer: "Buyer",
      listingAddress: "Listing",
    });
    const res = await POST(req, { params });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.entitlement.payment_flow).toBe("direct-purchase-skill");
    expect(mockVerifyAndRecord).toHaveBeenCalledWith({
      skill,
      signature: "txsig",
      buyerPubkey: "Buyer",
      listingAddress: "Listing",
    });
  });

  it("returns 400 when signature is missing", async () => {
    const { req, params } = makeRequest({});
    const res = await POST(req, { params });

    expect(res.status).toBe(400);
    expect(mockVerifyAndRecord).not.toHaveBeenCalled();
  });
});
