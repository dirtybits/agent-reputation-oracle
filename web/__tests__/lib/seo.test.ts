import { afterEach, describe, expect, it, vi } from "vitest";
import { buildDefaultMetadata, buildMetadata } from "@/lib/seo";
import { SITE_DESCRIPTION, truncateDescription } from "@/lib/site";

afterEach(() => vi.unstubAllEnvs());

describe("search descriptions", () => {
  it("states the staking currency in homepage and social metadata", () => {
    const metadata = buildDefaultMetadata();
    expect(SITE_DESCRIPTION).toMatch(/USDC/);
    expect(SITE_DESCRIPTION.length).toBeLessThanOrEqual(160);
    expect(metadata.description).toBe(SITE_DESCRIPTION);
    expect(metadata.openGraph?.description).toBe(SITE_DESCRIPTION);
    expect(metadata.twitter?.description).toBe(SITE_DESCRIPTION);
  });

  it("normalizes whitespace without shortening useful short text", () => {
    expect(truncateDescription("  Stake\n USDC\tto vouch. ")).toBe(
      "Stake USDC to vouch."
    );
  });

  it("stays within its budget and prefers a complete word", () => {
    expect(truncateDescription("Stake USDC behind authors", 18)).toBe(
      "Stake USDC behind…"
    );
    expect(truncateDescription("Stake USDC behind authors", 16)).toBe(
      "Stake USDC…"
    );
    expect(truncateDescription("x".repeat(200))).toHaveLength(160);
    expect(truncateDescription("long", 0)).toBe("");
    expect(truncateDescription("long", 1)).toBe("…");
  });

  it("does not split Unicode characters", () => {
    expect(truncateDescription("🦞".repeat(10), 3)).toBe("🦞🦞…");
  });

  it("uses the same bounded description across page and social metadata", () => {
    const metadata = buildMetadata({
      title: "AI agent skills",
      description: "Inspect USDC-backed reputation. ".repeat(10),
      path: "/skills",
    });
    expect(metadata.description!.length).toBeLessThanOrEqual(160);
    expect(metadata.openGraph?.description).toBe(metadata.description);
    expect(metadata.twitter?.description).toBe(metadata.description);
    expect(metadata.alternates?.canonical).toBe(
      "https://agentvouch.xyz/skills"
    );
  });
});
