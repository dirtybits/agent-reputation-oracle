import { beforeEach, describe, expect, it, vi } from "vitest";

const { query, posts } = vi.hoisted(() => ({ query: vi.fn(), posts: vi.fn() }));
vi.mock("@/lib/db", () => ({ sql: () => query }));
vi.mock("@/lib/blog", () => ({ getAllPosts: posts }));

import sitemap, { revalidate } from "@/app/sitemap";

const row = (id: string, updated_at: string) => ({
  id,
  skill_id: id,
  public_slug: id,
  public_author_slug: "test-author",
  author_pubkey: "test-author-key",
  updated_at,
});

beforeEach(() => {
  query.mockReset().mockResolvedValue([]);
  posts.mockReset().mockResolvedValue([]);
});

describe("search sitemap", () => {
  it("refreshes catalog discovery without needing a deployment", () => {
    expect(revalidate).toBe(3600);
  });

  it("does not fabricate modification dates for static pages", async () => {
    const entries = await sitemap();
    expect(entries.length).toBeGreaterThan(5);
    expect(entries.every((entry) => entry.lastModified === undefined)).toBe(
      true
    );
    expect(
      entries.some((entry) => /\/account|\/auth|\/sign-in/.test(entry.url))
    ).toBe(false);
  });

  it("uses article revisions, with publication dates as a fallback", async () => {
    posts.mockResolvedValue([
      {
        slug: "updated",
        publishedAt: "2026-04-02T00:00:00.000Z",
        updatedAt: "2026-09-07T00:00:00.000Z",
      },
      {
        slug: "original",
        publishedAt: "2026-04-02T00:00:00.000Z",
        updatedAt: null,
      },
      { slug: "undated", publishedAt: null, updatedAt: null },
    ]);
    const entries = await sitemap();
    expect(
      entries.find((entry) => entry.url.endsWith("/updated"))?.lastModified
    ).toEqual(new Date("2026-09-07T00:00:00.000Z"));
    expect(
      entries.find((entry) => entry.url.endsWith("/original"))?.lastModified
    ).toEqual(new Date("2026-04-02T00:00:00.000Z"));
    expect(
      entries.find((entry) => entry.url.endsWith("/undated"))?.lastModified
    ).toBeUndefined();
  });

  it("keeps the latest known author listing date regardless of row order", async () => {
    const newer = row("newer", "2026-09-07T00:00:00.000Z");
    const older = row("older", "2026-04-02T00:00:00.000Z");
    for (const rows of [
      [newer, older],
      [older, newer],
    ]) {
      query.mockResolvedValue(rows);
      const entries = await sitemap();
      const authors = entries.filter((entry) => entry.url.includes("/author/"));
      expect(authors).toHaveLength(1);
      expect(authors[0].lastModified).toEqual(new Date(newer.updated_at));
      expect(
        entries.some((entry) => entry.url.endsWith("/skills/test-author/newer"))
      ).toBe(true);
    }
  });

  it("omits invalid dates and wallet-less author URLs", async () => {
    query.mockResolvedValue([
      { ...row("undated", "bad-date"), author_pubkey: null },
    ]);
    const entries = await sitemap();
    expect(
      entries.find((entry) => entry.url.endsWith("/undated"))?.lastModified
    ).toBeUndefined();
    expect(entries.some((entry) => entry.url.includes("/author/"))).toBe(false);
  });

  it("fails a refresh rather than replacing a good sitemap with a partial one", async () => {
    query.mockRejectedValue(new Error("temporary catalog failure"));
    await expect(sitemap()).rejects.toThrow();
  });
});
