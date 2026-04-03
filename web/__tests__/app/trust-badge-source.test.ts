import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

describe("trust badge source", () => {
  it("shows author-wide report history without legacy voucher dispute copy", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "components/TrustBadge.tsx"),
      "utf8"
    );

    expect(source).toContain("Author Reports");
    expect(source).not.toContain("As Voucher");
    expect(source).not.toContain("No losses");
  });
});
