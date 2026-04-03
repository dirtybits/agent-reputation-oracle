import { address } from "@solana/kit";
import { describe, expect, it } from "vitest";
import {
  assessPurchasePreflight,
  PURCHASE_FEE_BUFFER_LAMPORTS,
  type PurchasePreflightContext,
} from "@/lib/purchasePreflight";

const PURCHASE_RENT_LAMPORTS = 1_510_320n;
const SYSTEM_RENT_LAMPORTS = 890_880n;
const AUTHOR = address("2DGYWtztLvPB6GxgGXT16gjCoEf56jEmwSxjMwK21Pg3");
const BUYER = address("asuavUDGmrVHr4oD1b4QtnnXgtnEcBa8qdkfZz7WZgw");

function createContext({
  buyerBalanceLamports = 10_000_000n,
  authorBalanceLamports = 0n,
}: {
  buyerBalanceLamports?: bigint;
  authorBalanceLamports?: bigint;
}): PurchasePreflightContext {
  return {
    buyer: BUYER,
    buyerBalanceLamports,
    purchaseRentLamports: PURCHASE_RENT_LAMPORTS,
    systemAccountRentExemptLamports: SYSTEM_RENT_LAMPORTS,
    authorBalanceLamportsByAddress: new Map([
      [String(AUTHOR), authorBalanceLamports],
    ]),
  };
}

describe("purchase preflight", () => {
  it("treats free listings as immediately purchasable", () => {
    const result = assessPurchasePreflight({
      context: createContext({}),
      priceLamports: 0n,
      author: AUTHOR,
    });

    expect(result.purchasePreflightStatus).toBe("ok");
    expect(result.estimatedBuyerTotalLamports).toBe(0n);
    expect(result.purchasePreflightMessage).toBeNull();
  });

  it("accepts a 0.001 SOL listing when buyer and author are both rent-safe", () => {
    const result = assessPurchasePreflight({
      context: createContext({
        buyerBalanceLamports: 5_000_000n,
        authorBalanceLamports: 1_000_000n,
      }),
      priceLamports: 1_000_000n,
      author: AUTHOR,
    });

    expect(result.purchasePreflightStatus).toBe("ok");
    expect(result.estimatedBuyerTotalLamports).toBe(
      1_000_000n + PURCHASE_RENT_LAMPORTS + PURCHASE_FEE_BUFFER_LAMPORTS
    );
  });

  it("blocks a 0.001 SOL listing when the author payout would stay below rent minimum", () => {
    const result = assessPurchasePreflight({
      context: createContext({
        buyerBalanceLamports: 50_000_000n,
        authorBalanceLamports: 0n,
      }),
      priceLamports: 1_000_000n,
      author: AUTHOR,
    });

    expect(result.purchasePreflightStatus).toBe("authorPayoutRentBlocked");
    expect(result.purchasePreflightMessage).toContain(
      "author's payout wallet is empty"
    );
  });

  it("allows a 0.1 SOL listing even if the author wallet starts empty", () => {
    const result = assessPurchasePreflight({
      context: createContext({
        buyerBalanceLamports: 500_000_000n,
        authorBalanceLamports: 0n,
      }),
      priceLamports: 100_000_000n,
      author: AUTHOR,
    });

    expect(result.purchasePreflightStatus).toBe("ok");
    expect(result.authorShareLamports).toBe(60_000_000n);
  });
});
