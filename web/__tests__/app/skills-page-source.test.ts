import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

describe("skills page source", () => {
  it("derives purchased state from both purchases and direct listing flags", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "app/skills/page.tsx"),
      "utf8"
    );

    expect(source).toContain("const purchasedSkillListingKeys = useMemo");
    expect(source).toContain("purchase.account.skillListing");
    expect(source).toContain("Already purchased with this wallet.");
    expect(source).toContain("Purchase status is temporarily unavailable");
    expect(source).not.toContain(") : purchaseStatusUnavailable ? (");
  });

  it("shows estimated totals and seller rent warnings for paid skills", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "app/skills/page.tsx"),
      "utf8"
    );

    expect(source).toContain("Estimated total");
    expect(source).toContain("Creator price");
    expect(source).toContain("Seller Needs SOL");
    expect(source).toContain("purchasePreflightStatus");
    expect(source).toContain("Low-priced sales are currently blocked");
    expect(source).toMatch(
      /will fail until this payout wallet\s+holds enough SOL/
    );
  });
});
