import { beforeEach, describe, expect, it, vi } from "vitest";

const { readFile, readdir } = vi.hoisted(() => ({
  readFile: vi.fn(),
  readdir: vi.fn(),
}));
vi.mock("fs/promises", () => ({ readFile, readdir }));

import { getAllPosts, getPost } from "@/lib/blog";

beforeEach(() => {
  readdir.mockResolvedValue(["2026-04-02-example.md"]);
});

describe("article dates", () => {
  it("preserves the publication date and exposes a genuine revision date", async () => {
    readFile.mockResolvedValue(
      "---\ntitle: Example\ndate: 2026-04-02\nupdated: 2026-09-07\n---\n# Example\nBody"
    );
    const expected = {
      publishedAt: "2026-04-02T00:00:00.000Z",
      updatedAt: "2026-09-07T00:00:00.000Z",
    };
    expect(await getPost("example")).toMatchObject(expected);
    expect((await getAllPosts())[0]).toMatchObject(expected);
  });

  it.each([
    "",
    "updated: invalid",
    "updated: 2026-02-30",
    "updated: 2026-01-01",
  ])("does not invent a modification date: %s", async (updated) => {
    readFile.mockResolvedValue(
      `---\ndate: 2026-04-02\n${updated}\n---\n# Example\nBody`
    );
    expect(await getPost("example")).toMatchObject({
      publishedAt: "2026-04-02T00:00:00.000Z",
      updatedAt: null,
    });
  });

  it("keeps legacy markdown posts readable", async () => {
    readFile.mockResolvedValue("# Example\n\n*An older article.*\n\nBody");
    expect(await getPost("example")).toMatchObject({
      title: "Example",
      subtitle: "An older article.",
      publishedAt: "2026-04-02T00:00:00.000Z",
      updatedAt: null,
    });
  });
});
