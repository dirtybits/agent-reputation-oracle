import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

describe("author page source", () => {
  it("explains skill-linked disputes without manual voucher selection", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "app/author/[pubkey]/page.tsx"),
      "utf8"
    );

    expect(source).not.toContain("Link backing vouchers");
    expect(source).not.toContain("Link to report");
    expect(source).toContain("Author-wide backing snapshot");
    expect(source).toContain("skill-linked author dispute");
    expect(source).toContain("Free-skill disputes cap slashing at author bond");
  });
});
