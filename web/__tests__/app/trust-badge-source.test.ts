import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

describe("trust badge source", () => {
  it("separates voucher history from author-wide report history", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "components/TrustBadge.tsx"),
      "utf8"
    );

    expect(source).toContain("As Voucher");
    expect(source).toContain("No losses");
    expect(source).not.toContain("Vouch Disputes");
  });
});
