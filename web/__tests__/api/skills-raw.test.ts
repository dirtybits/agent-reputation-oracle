import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/db", () => ({
  sql: vi.fn(),
  initializeDatabase: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/onchain", () => ({
  getOnChainPrice: vi.fn(),
}));

vi.mock("@/lib/auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth")>(
    "@/lib/auth"
  );

  return {
    ...actual,
    verifyWalletSignature: vi.fn(),
    buildDownloadRawMessage: vi.fn(),
  };
});

vi.mock("@/lib/x402", () => ({
  buildX402PaymentRequiredBody: vi.fn((input) => input),
  decodeX402PaymentSignatureHeader: vi.fn(),
  encodeX402PaymentRequiredHeader: vi
    .fn()
    .mockReturnValue("encoded-payment-required"),
  encodeX402PaymentResponseHeader: vi
    .fn()
    .mockReturnValue("encoded-payment-response"),
  generatePaymentRequirement: vi.fn(),
  generateX402UsdcRequirement: vi.fn().mockResolvedValue({
    scheme: "exact",
    network: "solana",
    amount: "1000000",
  }),
  hasOnChainPurchase: vi.fn(),
  settleX402Payment: vi.fn(),
  verifySettledUsdcTransfer: vi.fn(),
  verifyX402Payment: vi.fn(),
}));

vi.mock("@/lib/usdcPurchases", () => ({
  hasUsdcPurchaseEntitlement: vi.fn(),
  recordUsdcPurchaseReceipt: vi.fn(),
}));

import { GET } from "@/app/api/skills/[id]/raw/route";
import { sql } from "@/lib/db";
import { getOnChainPrice } from "@/lib/onchain";
import { verifyWalletSignature, buildDownloadRawMessage } from "@/lib/auth";
import { generatePaymentRequirement, hasOnChainPurchase } from "@/lib/x402";
import { hasUsdcPurchaseEntitlement } from "@/lib/usdcPurchases";

const mockSql = sql as unknown as ReturnType<typeof vi.fn>;
const mockOnChain = getOnChainPrice as unknown as ReturnType<typeof vi.fn>;
const mockVerifySig = verifyWalletSignature as unknown as ReturnType<
  typeof vi.fn
>;
const mockBuildMsg = buildDownloadRawMessage as unknown as ReturnType<
  typeof vi.fn
>;
const mockGenerate = generatePaymentRequirement as unknown as ReturnType<
  typeof vi.fn
>;
const mockHasPurchase = hasOnChainPurchase as unknown as ReturnType<
  typeof vi.fn
>;
const mockHasUsdcEntitlement = hasUsdcPurchaseEntitlement as unknown as ReturnType<
  typeof vi.fn
>;

function makeRequest(id: string, headers: Record<string, string> = {}) {
  const url = new URL(`http://localhost/api/skills/${id}/raw`);
  const req = new NextRequest(url, { method: "GET", headers });
  const params = Promise.resolve({ id });
  return { req, params };
}

const SKILL_CONTENT = "# My Skill\nHello world";
const PAID_SKILL = {
  id: "uuid-paid",
  on_chain_address: "ListingAddr1",
  author_pubkey: "Author1",
  skill_id: "s-paid",
  content: SKILL_CONTENT,
};

const USDC_SKILL = {
  id: "uuid-usdc",
  on_chain_address: null,
  author_pubkey: "11111111111111111111111111111111",
  skill_id: "s-usdc",
  name: "USDC Skill",
  content: SKILL_CONTENT,
  price_usdc_micros: "1000000",
  currency_mint: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
};

function validAuthHeader(
  id: string,
  listing: string,
  message = "correct-message"
) {
  return JSON.stringify({
    pubkey: "BuyerPubkey1",
    signature: "dummysig",
    message,
    timestamp: Date.now(),
  });
}

describe("GET /api/skills/[id]/raw", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 404 when skill not found", async () => {
    const dbQuery = vi.fn().mockResolvedValueOnce([]);
    mockSql.mockReturnValue(dbQuery);

    const { req, params } = makeRequest("uuid-nope");
    const res = await GET(req, { params });
    expect(res.status).toBe(404);
  });

  it("returns content directly for free skill (no on_chain_address)", async () => {
    const dbQuery = vi
      .fn()
      .mockResolvedValueOnce([
        {
          id: "uuid-1",
          on_chain_address: null,
          author_pubkey: "A",
          skill_id: "s1",
          content: SKILL_CONTENT,
        },
      ])
      .mockResolvedValueOnce([]);
    mockSql.mockReturnValue(dbQuery);

    const { req, params } = makeRequest("uuid-1");
    const res = await GET(req, { params });
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toBe(SKILL_CONTENT);
    expect(res.headers.get("Content-Type")).toContain("text/markdown");
  });

  it("returns content directly for skill with 0 on-chain price", async () => {
    const dbQuery = vi
      .fn()
      .mockResolvedValueOnce([
        {
          id: "uuid-2",
          on_chain_address: "Chain1",
          author_pubkey: "A",
          skill_id: "s2",
          content: SKILL_CONTENT,
        },
      ])
      .mockResolvedValueOnce([]);
    mockSql.mockReturnValue(dbQuery);
    mockOnChain.mockResolvedValue({ price: 0, author: "A" });

    const { req, params } = makeRequest("uuid-2");
    const res = await GET(req, { params });
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toBe(SKILL_CONTENT);
  });

  it("returns 402 for paid skill with no auth header", async () => {
    const dbQuery = vi.fn().mockResolvedValueOnce([PAID_SKILL]);
    mockSql.mockReturnValue(dbQuery);
    mockOnChain.mockResolvedValue({ price: 100_000_000, author: "Author1" });
    mockGenerate.mockReturnValue({
      scheme: "exact",
      instruction: "purchaseSkill",
      skillListingAddress: "ListingAddr1",
      amount: 100_000_000,
    });

    const { req, params } = makeRequest("uuid-paid");
    const res = await GET(req, { params });
    expect(res.status).toBe(402);
    const body = await res.json();
    expect(body.error).toContain("Payment required");
    expect(body.message).toContain("X-AgentVouch-Auth");
    expect(body.message).toContain("/docs#paid-skill-download");
    expect(res.headers.get("X-Payment")).toBeTruthy();
  });

  it("passes skillListingAddress to generatePaymentRequirement", async () => {
    const dbQuery = vi.fn().mockResolvedValueOnce([PAID_SKILL]);
    mockSql.mockReturnValue(dbQuery);
    mockOnChain.mockResolvedValue({ price: 50_000_000, author: "Author1" });
    mockGenerate.mockReturnValue({ scheme: "exact" });

    const { req, params } = makeRequest("uuid-paid");
    await GET(req, { params });

    expect(mockGenerate).toHaveBeenCalledWith(
      expect.objectContaining({
        skillListingAddress: "ListingAddr1",
        priceLamports: 50_000_000,
      })
    );
  });

  it("returns 400 for malformed X-AgentVouch-Auth header", async () => {
    const dbQuery = vi.fn().mockResolvedValueOnce([PAID_SKILL]);
    mockSql.mockReturnValue(dbQuery);
    mockOnChain.mockResolvedValue({ price: 100_000_000, author: "Author1" });

    const { req, params } = makeRequest("uuid-paid", {
      "x-agentvouch-auth": "not-json!!!",
    });
    const res = await GET(req, { params });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Malformed");
  });

  it("returns 401 when signature verification fails", async () => {
    const dbQuery = vi.fn().mockResolvedValueOnce([PAID_SKILL]);
    mockSql.mockReturnValue(dbQuery);
    mockOnChain.mockResolvedValue({ price: 100_000_000, author: "Author1" });
    mockVerifySig.mockReturnValue({
      valid: false,
      pubkey: null,
      error: "Invalid signature",
    });

    const auth = validAuthHeader("uuid-paid", "ListingAddr1");
    const { req, params } = makeRequest("uuid-paid", {
      "x-agentvouch-auth": auth,
    });
    const res = await GET(req, { params });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toContain("Invalid signature");
  });

  it("returns 401 when message scope does not match", async () => {
    const dbQuery = vi.fn().mockResolvedValueOnce([PAID_SKILL]);
    mockSql.mockReturnValue(dbQuery);
    mockOnChain.mockResolvedValue({ price: 100_000_000, author: "Author1" });
    mockVerifySig.mockReturnValue({ valid: true, pubkey: "BuyerPubkey1" });
    mockBuildMsg.mockReturnValue("expected-message-from-builder");

    const auth = validAuthHeader("uuid-paid", "ListingAddr1", "wrong-message");
    const { req, params } = makeRequest("uuid-paid", {
      "x-agentvouch-auth": auth,
    });
    const res = await GET(req, { params });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toContain("scope mismatch");
  });

  it("returns 402 when signature is valid but no on-chain purchase", async () => {
    const dbQuery = vi.fn().mockResolvedValueOnce([PAID_SKILL]);
    mockSql.mockReturnValue(dbQuery);
    mockOnChain.mockResolvedValue({ price: 100_000_000, author: "Author1" });
    mockVerifySig.mockReturnValue({ valid: true, pubkey: "BuyerPubkey1" });
    mockBuildMsg.mockReturnValue("correct-message");
    mockHasPurchase.mockResolvedValue(false);
    mockGenerate.mockReturnValue({
      scheme: "exact",
      instruction: "purchaseSkill",
      skillListingAddress: "ListingAddr1",
    });

    const auth = validAuthHeader("uuid-paid", "ListingAddr1");
    const { req, params } = makeRequest("uuid-paid", {
      "x-agentvouch-auth": auth,
    });
    const res = await GET(req, { params });
    expect(res.status).toBe(402);
    const body = await res.json();
    expect(body.error).toContain("Purchase not found");
  });

  it("returns 200 with content when signed auth + on-chain purchase are valid", async () => {
    const dbQuery = vi
      .fn()
      .mockResolvedValueOnce([PAID_SKILL])
      .mockResolvedValueOnce([]);
    mockSql.mockReturnValue(dbQuery);
    mockOnChain.mockResolvedValue({ price: 100_000_000, author: "Author1" });
    mockVerifySig.mockReturnValue({ valid: true, pubkey: "BuyerPubkey1" });
    mockBuildMsg.mockReturnValue("correct-message");
    mockHasPurchase.mockResolvedValue(true);

    const auth = validAuthHeader("uuid-paid", "ListingAddr1");
    const { req, params } = makeRequest("uuid-paid", {
      "x-agentvouch-auth": auth,
    });
    const res = await GET(req, { params });
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toBe(SKILL_CONTENT);
    expect(res.headers.get("Content-Type")).toContain("text/markdown");
    expect(mockHasPurchase).toHaveBeenCalledWith(
      "BuyerPubkey1",
      "ListingAddr1"
    );
  });

  it("accepts CRLF line endings in the signed message", async () => {
    const dbQuery = vi
      .fn()
      .mockResolvedValueOnce([PAID_SKILL])
      .mockResolvedValueOnce([]);
    mockSql.mockReturnValue(dbQuery);
    mockOnChain.mockResolvedValue({ price: 100_000_000, author: "Author1" });
    mockVerifySig.mockReturnValue({ valid: true, pubkey: "BuyerPubkey1" });
    mockBuildMsg.mockReturnValue("line1\nline2\nline3");
    mockHasPurchase.mockResolvedValue(true);

    const auth = JSON.stringify({
      pubkey: "BuyerPubkey1",
      signature: "sig",
      message: "line1\r\nline2\r\nline3",
      timestamp: Date.now(),
    });
    const { req, params } = makeRequest("uuid-paid", {
      "x-agentvouch-auth": auth,
    });
    const res = await GET(req, { params });

    expect(res.status).toBe(200);
  });

  it("uses verified pubkey (not client-supplied) for PDA check", async () => {
    const dbQuery = vi
      .fn()
      .mockResolvedValueOnce([PAID_SKILL])
      .mockResolvedValueOnce([]);
    mockSql.mockReturnValue(dbQuery);
    mockOnChain.mockResolvedValue({ price: 100_000_000, author: "Author1" });
    mockVerifySig.mockReturnValue({
      valid: true,
      pubkey: "ServerVerifiedPubkey",
    });
    mockBuildMsg.mockReturnValue("correct-message");
    mockHasPurchase.mockResolvedValue(true);

    const auth = JSON.stringify({
      pubkey: "ClientClaimedPubkey",
      signature: "sig",
      message: "correct-message",
      timestamp: Date.now(),
    });
    const { req, params } = makeRequest("uuid-paid", {
      "x-agentvouch-auth": auth,
    });
    await GET(req, { params });

    expect(mockHasPurchase).toHaveBeenCalledWith(
      "ServerVerifiedPubkey",
      "ListingAddr1"
    );
    expect(mockHasPurchase).not.toHaveBeenCalledWith(
      "ClientClaimedPubkey",
      expect.anything()
    );
  });

  it("serves USDC entitlement downloads without an on-chain listing", async () => {
    const dbQuery = vi
      .fn()
      .mockResolvedValueOnce([USDC_SKILL])
      .mockResolvedValueOnce([]);
    mockSql.mockReturnValue(dbQuery);
    mockVerifySig.mockReturnValue({ valid: true, pubkey: "BuyerPubkey1" });
    mockBuildMsg.mockImplementation(
      (
        skillId: string,
        listingAddress: string | null | undefined,
        timestamp: number
      ) =>
        `AgentVouch Skill Download\nAction: download-raw\nSkill id: ${skillId}\nListing: ${listingAddress ?? "x402-usdc-direct"}\nTimestamp: ${timestamp}`
    );
    mockHasUsdcEntitlement.mockResolvedValue(true);

    const auth = JSON.stringify({
      pubkey: "BuyerPubkey1",
      signature: "sig",
      message:
        "AgentVouch Skill Download\nAction: download-raw\nSkill id: uuid-usdc\nListing: x402-usdc-direct\nTimestamp: 1709234567890",
      timestamp: 1709234567890,
    });
    const { req, params } = makeRequest("uuid-usdc", {
      "x-agentvouch-auth": auth,
    });
    const res = await GET(req, { params });

    expect(res.status).toBe(200);
    expect(await res.text()).toBe(SKILL_CONTENT);
    expect(mockHasUsdcEntitlement).toHaveBeenCalledWith(
      "uuid-usdc",
      "BuyerPubkey1"
    );
  });

  it("legacy ?buyer= no longer grants access to paid skills", async () => {
    const dbQuery = vi.fn().mockResolvedValueOnce([PAID_SKILL]);
    mockSql.mockReturnValue(dbQuery);
    mockOnChain.mockResolvedValue({ price: 100_000_000, author: "Author1" });
    mockGenerate.mockReturnValue({ scheme: "exact" });

    const url = new URL("http://localhost/api/skills/uuid-paid/raw");
    url.searchParams.set("buyer", "SomeValidPubkeyXXXXXXXXXXXXXXXXX");
    const req = new NextRequest(url, { method: "GET" });
    const params = Promise.resolve({ id: "uuid-paid" });
    const res = await GET(req, { params });

    expect(res.status).toBe(402);
    expect(mockHasPurchase).not.toHaveBeenCalled();
  });
});
