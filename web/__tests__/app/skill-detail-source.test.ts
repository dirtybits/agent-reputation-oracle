import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

describe("skill detail source", () => {
  it("shows creator price, estimated total, and preflight warnings", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "app/skills/[id]/page.tsx"),
      "utf8"
    );

    expect(source).toContain("Estimated total");
    expect(source).toContain("Creator price");
    expect(source).toContain("Receipt rent");
    expect(source).toContain("Seller Needs SOL");
    expect(source).toContain("purchasePreflightMessage");
  });

  it("documents signed download instructions for paid skills", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "app/skills/[id]/page.tsx"),
      "utf8"
    );

    expect(source).toContain("X-AgentVouch-Auth");
    expect(source).toContain("AgentVouch Skill Download");
    expect(source).toContain("/docs#paid-skill-download");
    expect(source).toContain("Call purchaseSkill on-chain");
    expect(source).toContain("buyerHasPurchased");
    expect(source).toContain("Buy & Unlock");
    expect(source).toContain("Sign & Download");
    expect(source).toContain("buildDownloadRawMessage");
    expect(source).toContain("buildPaidSkillDownloadRequiredMessage");
    expect(source).toContain("buildSignedDownloadErrorMessage");
    expect(source).not.toContain("Buy & Install");
  });
});
