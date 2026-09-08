import { describe, expect, it, vi } from "vitest";

const { permanentRedirect, getPost } = vi.hoisted(() => ({
  permanentRedirect: vi.fn(),
  getPost: vi.fn(),
}));
vi.mock("next/navigation", () => ({ permanentRedirect, notFound: vi.fn() }));
vi.mock("@/lib/blog", () => ({ getPost, getAllSlugs: vi.fn() }));
// Metadata checks should not initialize wallet/auth UI or Markdown plugins.
vi.mock("@/components/BuyerWalletLinks", () => ({
  BuyerWalletLinks: () => null,
}));
vi.mock("@/components/MarkdownRenderer", () => ({ default: () => null }));

import { GET } from "@/app/robots.txt/route";
import MarketplaceRedirect from "@/app/marketplace/page";
import { metadata as account } from "@/app/account/page";
import { metadata as auth } from "@/app/auth/layout";
import { metadata as signIn } from "@/app/sign-in/layout";
import { metadata as dashboard } from "@/app/dashboard/layout";
import { metadata as settings } from "@/app/settings/layout";
import { generateMetadata } from "@/app/blog/[slug]/page";

describe("route indexing controls", () => {
  it.each([
    ["/account", account],
    ["/auth/callback", auth],
    ["/sign-in", signIn],
    ["/dashboard", dashboard],
    ["/settings", settings],
  ] as const)(
    "keeps %s out of search without inheriting the homepage canonical",
    async (path, metadata) => {
      expect(metadata.robots).toEqual({ index: false, follow: false });
      expect(metadata.alternates?.canonical).toBe(
        `https://agentvouch.xyz${path}`
      );
      const robots = await GET().text();
      expect(robots).not.toContain(`Disallow: ${path}`);
      expect(robots).toContain("Disallow: /api/");
      expect(robots).toContain("Sitemap: https://agentvouch.xyz/sitemap.xml");
    }
  );

  it("permanently redirects the legacy marketplace route", () => {
    MarketplaceRedirect();
    expect(permanentRedirect).toHaveBeenCalledWith("/skills");
  });

  it("shares an article with its own image and real dates", async () => {
    getPost.mockResolvedValue({
      title: "Example",
      subtitle: "USDC-backed reputation",
      image: "/example.png",
      tags: ["agent reputation"],
      publishedAt: "2026-04-02T00:00:00.000Z",
      updatedAt: "2026-09-07T00:00:00.000Z",
    });
    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: "example" }),
    });
    expect(metadata.openGraph).toMatchObject({
      type: "article",
      publishedTime: "2026-04-02T00:00:00.000Z",
      modifiedTime: "2026-09-07T00:00:00.000Z",
      images: [{ url: "https://agentvouch.xyz/example.png", alt: "Example" }],
    });
    expect(metadata.twitter?.images).toEqual([
      "https://agentvouch.xyz/example.png",
    ]);
  });
});
