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
    expect(source).toContain("Legacy fallback");
    expect(source).toContain("Receipt rent");
    expect(source).toContain("Seller Needs SOL");
    expect(source).toContain("purchasePreflightMessage");
  });

  it("documents signed download instructions for paid skills", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "app/skills/[id]/page.tsx"),
      "utf8"
    );

    expect(source).toContain(
      "This connected wallet is the author for this skill. Use the author actions below to manage the listing instead of purchasing it."
    );
    expect(source).toContain('href="#author-actions"');
    expect(source).toContain("Manage Listing");
    expect(source).toContain("X-AgentVouch-Auth");
    expect(source).toContain("/docs#paid-skill-download");
    expect(source).toContain("Call purchaseSkill on-chain");
    expect(source).toContain("buyerHasPurchased");
    expect(source).toContain("UsdcIcon");
    expect(source).toContain("Pay with USDC");
    expect(source).toContain("Use SOL Fallback");
    expect(source).toContain("Buy & Unlock");
    expect(source).toContain("Sign & Download");
    expect(source).toContain("buildDownloadRawMessage");
    expect(source).toContain("createSignedDownloadAuthPayload");
    expect(source).toContain("buildPaidSkillDownloadRequiredMessage");
    expect(source).toContain("buildSignedDownloadErrorMessage");
    expect(source).not.toContain("Buy & Install");
  });

  it("keeps repo-backed listing edits and repo version publishing as separate author actions", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "app/skills/[id]/page.tsx"),
      "utf8"
    );

    expect(source).toContain("Repo-backed listings stay pinned to the canonical raw");
    expect(source).toContain("endpoint.");
    expect(source).toContain("Publish New Version");
    expect(source).toContain("buildSignMessage");
    expect(source).toContain('requestedAuthorAction === "publish-version"');
    expect(source).toContain("Listing edits stay on the on-chain path.");
  });
});
