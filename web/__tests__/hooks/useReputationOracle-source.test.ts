import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

describe("useReputationOracle source", () => {
  it("memoizes the returned API object", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "hooks/useReputationOracle.ts"),
      "utf8"
    );

    expect(source).toContain("return useMemo(");
    expect(source).toContain("connected: !!connected");
    expect(source).toContain("getPurchasedSkillListingKeys");
  });

  it("re-checks the purchase PDA after a failed purchase send", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "hooks/useReputationOracle.ts"),
      "utf8"
    );

    expect(source).toContain("const existingPurchaseAfterFailure");
    expect(source).toContain("if (existingPurchaseAfterFailure?.exists)");
    expect(source).toContain("alreadyPurchased: true");
  });

  it("runs the shared purchase preflight before sending a paid purchase", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "hooks/useReputationOracle.ts"),
      "utf8"
    );

    expect(source).toContain("estimatePurchasePreflight");
    expect(source).toContain("purchasePreflightStatus === \"authorPayoutRentBlocked\"");
    expect(source).toContain("buildPurchaseBalanceError");
  });
});
