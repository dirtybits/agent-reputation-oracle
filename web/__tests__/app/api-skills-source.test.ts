import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

describe("skills api source", () => {
  it("hydrates buyer purchase state for USDC and SOL listings", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "app/api/skills/route.ts"),
      "utf8"
    );

    expect(source).toContain("buyerHasPurchased");
    expect(source).toContain("hasUsdcPurchaseEntitlement");
    expect(source).toContain("hasOnChainPurchase");
  });

  it("exposes repo listing activity plus recent USDC receipts", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "app/api/skills/activity/route.ts"),
      "utf8"
    );

    expect(source).toContain("usdc_purchase_receipts");
    expect(source).toContain("price_usdc_micros");
    expect(source).toContain("payment_flow");
  });
});
