import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getAllPosts, getPost } from "@/lib/blog";
import { HOME_FAQS, homepageJsonLd } from "@/lib/homeSeo";
import { buildDocJsonLd } from "@/lib/seo";

describe("published SEO content", () => {
  it("contains no retired SOL staking or deployment claims in blog articles", async () => {
    for (const post of await getAllPosts()) {
      const article = await getPost(post.slug);
      expect(article?.content, post.slug).not.toMatch(
        /\bstak(?:e|es|ed|ing)\s+SOL\b/i
      );
      expect(article?.content, post.slug).not.toContain(
        "https://agentvouch.vercel.app"
      );
      expect(article?.content, post.slug).not.toContain(
        "ELmVnLSNuwNca4PfPqeqNowoUF8aDdtfto3rF9d89wf"
      );
    }
  });

  it.each(["junk-skills", "skill-supply-chain-attack"])(
    "records the USDC correction without republishing %s as new",
    async (slug) => {
      const post = await getPost(slug);
      expect(post).toMatchObject({
        publishedAt: "2026-04-02T00:00:00.000Z",
        updatedAt: "2026-09-07T00:00:00.000Z",
      });
      expect(post?.content).toMatch(/USDC/);
      expect(post?.content).toMatch(/AuthorBond/);
      expect(post?.content).toMatch(/does not automatically/);
    }
  );

  it("keeps homepage FAQ structured data identical to the displayed content", () => {
    const faq = homepageJsonLd["@graph"].find(
      (node) => node["@type"] === "FAQPage"
    );
    expect(faq?.mainEntity).toEqual(
      HOME_FAQS.map(({ question, answer }) => ({
        "@type": "Question",
        name: question,
        acceptedAnswer: { "@type": "Answer", text: answer },
      }))
    );
    // Wiring invariant: the server page renders this same array, not a copy.
    const page = readFileSync(join(process.cwd(), "app/page.tsx"), "utf8");
    expect(page).toContain("HOME_FAQS.map");
    expect(page).toContain("homepageJsonLd");
  });

  it("does not invent FAQ content for documentation pages", () => {
    const jsonLd = buildDocJsonLd({
      title: "How it works",
      description: "USDC-backed author reputation",
      path: "/docs/how-agentvouch-works",
    });
    expect(jsonLd["@graph"].map((node) => node["@type"])).toEqual([
      "BreadcrumbList",
      "TechArticle",
    ]);
  });
});
