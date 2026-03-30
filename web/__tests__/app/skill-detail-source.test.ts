import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

describe("skill detail source", () => {
  it("shows creator price, estimated total, and preflight warnings", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "app/skills/[id]/page.tsx"),
      "utf8"
    );

    expect(source).toContain("Estimated Total");
    expect(source).toContain("Creator Price");
    expect(source).toContain("Receipt Rent");
    expect(source).toContain("Seller Needs SOL");
    expect(source).toContain("purchasePreflightMessage");
  });
});
