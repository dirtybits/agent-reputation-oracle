import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@solana/kit", () => ({
  createSolanaRpc: () => "mock-rpc",
  isAddress: () => true,
  getBytesEncoder: () => ({
    encode: (value: Uint8Array) => value,
  }),
  getAddressEncoder: () => ({
    encode: (value: string) => new TextEncoder().encode(value),
  }),
  getProgramDerivedAddress: async () => ["PurchasePDA", 255],
}));

const mockFetchMaybePurchase = vi.fn();
const mockFetchMaybeSkillListing = vi.fn();
vi.mock("../../generated/agentvouch/src/generated", () => ({
  fetchMaybePurchase: (...args: unknown[]) => mockFetchMaybePurchase(...args),
  fetchMaybeSkillListing: (...args: unknown[]) =>
    mockFetchMaybeSkillListing(...args),
}));

vi.mock("../../generated/agentvouch/src/generated/programs", () => ({
  AGENTVOUCH_PROGRAM_ADDRESS:
    "CVpe18yvJ4nJxHivqu8G85TSKn8YVZcWaVE3z8afrQnW",
}));

const mockRecordReceipt = vi.fn();
vi.mock("@/lib/usdcPurchases", () => ({
  DIRECT_PURCHASE_PAYMENT_FLOW: "direct-purchase-skill",
  recordUsdcPurchaseReceipt: (...args: unknown[]) => mockRecordReceipt(...args),
}));

import { verifyAndRecordDirectPurchase } from "@/lib/directPurchaseVerification";

const SKILL = {
  id: "00000000-0000-0000-0000-000000000001",
  on_chain_address: "Listing",
  author_pubkey: "Author",
  price_usdc_micros: "1000000",
  currency_mint: "Mint",
  chain_context: "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
  on_chain_protocol_version: "v0.2.0",
  on_chain_program_id: "CVpe18yvJ4nJxHivqu8G85TSKn8YVZcWaVE3z8afrQnW",
};

function mockTransaction(overrides: Record<string, unknown> = {}) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        result: {
          meta: { err: null },
          transaction: {
            message: {
              accountKeys: [
                { pubkey: "Buyer", signer: true },
                { pubkey: "Listing" },
                { pubkey: "PurchasePDA" },
                { pubkey: "CVpe18yvJ4nJxHivqu8G85TSKn8YVZcWaVE3z8afrQnW" },
              ],
              instructions: [
                {
                  programId: "CVpe18yvJ4nJxHivqu8G85TSKn8YVZcWaVE3z8afrQnW",
                },
              ],
            },
          },
          ...overrides,
        },
      }),
    })
  );
}

describe("verifyAndRecordDirectPurchase", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    mockTransaction();
    mockFetchMaybeSkillListing.mockResolvedValue({
      exists: true,
      data: {
        author: "Author",
        priceUsdcMicros: 1000000n,
        rewardVault: "RewardVault",
      },
    });
    mockFetchMaybePurchase.mockResolvedValue({
      exists: true,
      data: {
        buyer: "Buyer",
        skillListing: "Listing",
        pricePaidUsdcMicros: 1000000n,
        usdcMint: "Mint",
      },
    });
  });

  it("records a direct purchase receipt and entitlement after verification", async () => {
    const result = await verifyAndRecordDirectPurchase({
      skill: SKILL,
      signature: "txsig",
      buyerPubkey: "Buyer",
      listingAddress: "Listing",
    });

    expect(result.paymentFlow).toBe("direct-purchase-skill");
    expect(result.purchasePda).toBe("PurchasePDA");
    expect(mockRecordReceipt).toHaveBeenCalledWith(
      expect.objectContaining({
        skillDbId: SKILL.id,
        buyerPubkey: "Buyer",
        paymentTxSignature: "txsig",
        recipientAta: "RewardVault",
        currencyMint: "Mint",
        amountMicros: "1000000",
        paymentFlow: "direct-purchase-skill",
        protocolVersion: "v0.2.0",
        onChainAddress: "Listing",
        purchasePda: "PurchasePDA",
      })
    );
  });

  it("rejects transactions that do not execute the program", async () => {
    mockTransaction({
      transaction: {
        message: {
          accountKeys: [
            { pubkey: "Buyer", signer: true },
            { pubkey: "Listing" },
            { pubkey: "PurchasePDA" },
            { pubkey: "CVpe18yvJ4nJxHivqu8G85TSKn8YVZcWaVE3z8afrQnW" },
          ],
          instructions: [{ programId: "OtherProgram" }],
        },
      },
    });

    await expect(
      verifyAndRecordDirectPurchase({
        skill: SKILL,
        signature: "txsig",
        buyerPubkey: "Buyer",
        listingAddress: "Listing",
      })
    ).rejects.toThrow("did not execute");
    expect(mockRecordReceipt).not.toHaveBeenCalled();
  });
});
