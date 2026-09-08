import { describe, expect, it, vi } from "vitest";
const { summary } = vi.hoisted(() => ({ summary: vi.fn() }));
vi.mock("@/lib/metadataData", () => ({ getSkillMetadataSummary: summary }));
vi.mock("@/lib/skillRouteResolver", () => ({
  getCanonicalSkillPath: () => "/skills/author/example",
}));

import { buildSkillPageMetadata } from "@/lib/skillPageMetadata";
const route = {
  id: "example",
  skill_id: "example",
  public_slug: "example",
  public_author_slug: "author",
};

describe("skill search metadata", () => {
  it("expresses backing in USDC, not database micro-units or recommendation jargon", async () => {
    summary.mockResolvedValue({
      name: "Example",
      description: "A useful skill.",
      trustSummary: { recommended_action: "allow", totalStakedFor: "5250000" },
    });
    const metadata = await buildSkillPageMetadata(route, "/skills/example");
    expect(metadata.description).toContain("5.25 USDC staked");
    expect(metadata.description).not.toMatch(/micros|allow|guarantee/i);
    expect(metadata.alternates?.canonical).toBe(
      "https://agentvouch.xyz/skills/author/example"
    );
  });

  it("does not synthesize backing for an unverified publisher", async () => {
    summary.mockResolvedValue({
      name: "Example",
      description: "A useful skill.",
      trustSummary: null,
      authorHandle: "publisher",
    });
    const metadata = await buildSkillPageMetadata(route, "/skills/example");
    expect(metadata.description).toContain(
      "Published by unverified @publisher."
    );
    expect(metadata.description).not.toContain("USDC staked");
  });
});
