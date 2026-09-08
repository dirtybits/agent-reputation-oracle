import type { MetadataRoute } from "next";
import { sql } from "@/lib/db";
import { getAllPosts } from "@/lib/blog";
import { getCanonicalUrl } from "@/lib/site";
import { CONTENT_PAGES } from "@/lib/contentPages";
import { getPublicSkillPath } from "@/lib/skillUrls";

// Discover new listings without waiting for another deployment.
export const revalidate = 3600;

type SkillSitemapRow = {
  id: string;
  skill_id: string;
  public_slug: string;
  public_author_slug: string;
  author_pubkey: string | null;
  updated_at: string;
};

function knownDate(value: string | null | undefined): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const blogPosts = await getAllPosts();
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: getCanonicalUrl("/"),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: getCanonicalUrl("/agent-reputation-system"),
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: getCanonicalUrl("/docs"),
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: getCanonicalUrl("/skills"),
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: getCanonicalUrl("/blog"),
      changeFrequency: "weekly",
      priority: 0.7,
    },
    ...CONTENT_PAGES.map((page) => ({
      url: getCanonicalUrl(`/docs/${page.slug}`),
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
    ...blogPosts.map((post) => ({
      url: getCanonicalUrl(`/blog/${post.slug}`),
      lastModified: knownDate(post.updatedAt ?? post.publishedAt),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
  ];

  // Let failed ISR refreshes retain the previous complete sitemap. Returning
  // static pages on a database error would silently drop the whole catalog.
  const rows = await sql()<SkillSitemapRow>`
      SELECT id, skill_id, public_slug, public_author_slug, author_pubkey, updated_at
      FROM skills
      ORDER BY updated_at DESC
    `;

  const skillPages: MetadataRoute.Sitemap = rows.map((row) => ({
    url: getCanonicalUrl(getPublicSkillPath(row)),
    lastModified: knownDate(row.updated_at),
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  const authors = new Map<
    string,
    MetadataRoute.Sitemap[number] & { lastModified?: Date }
  >();
  for (const row of rows) {
    if (!row.author_pubkey) continue;
    const lastModified = knownDate(row.updated_at);
    const existing = authors.get(row.author_pubkey);
    if (
      !existing ||
      (lastModified &&
        (!existing.lastModified || lastModified > existing.lastModified))
    ) {
      authors.set(row.author_pubkey, {
        url: getCanonicalUrl(`/author/${row.author_pubkey}`),
        lastModified,
        changeFrequency: "weekly",
        priority: 0.7,
      });
    }
  }

  return [...staticPages, ...skillPages, ...authors.values()];
}
