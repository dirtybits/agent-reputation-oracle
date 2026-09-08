import { readdir, readFile } from "fs/promises";
import { join } from "path";

// Blog posts support optional frontmatter for SEO fields. Posts without
// frontmatter still work: title comes from the first `# ` heading and an
// optional subtitle from a following `*italic*` line. Filenames may carry a
// leading `YYYY-MM-DD-` prefix for ordering; it is stripped from the public slug.
const BLOG_DIR = join(process.cwd(), "content", "blog");

export interface BlogPostMeta {
  slug: string;
  title: string;
  subtitle: string | null;
  publishedAt: string | null;
  updatedAt: string | null;
  image: string | null;
  tags: string[];
}

export interface BlogPost extends BlogPostMeta {
  content: string;
}

function slugFromFile(file: string): string {
  return file.replace(/\.md$/i, "").replace(/^\d{4}-\d{2}-\d{2}-/, "");
}

function publishedAtFromFile(file: string): string | null {
  const match = file.match(/^(\d{4}-\d{2}-\d{2})-/);
  const date = match?.[1];
  return normalizeDate(date);
}

function normalizeDate(date: string | undefined): string | null {
  if (!date) return null;
  const trimmed = date.trim();
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  const iso = parsed.toISOString();
  // Date normalizes impossible days (e.g. February 30); don't publish those.
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed) && iso.slice(0, 10) !== trimmed) {
    return null;
  }
  return iso;
}

function revisionDate(value: string | undefined, publishedAt: string | null) {
  const updatedAt = normalizeDate(value);
  return updatedAt && (!publishedAt || updatedAt >= publishedAt)
    ? updatedAt
    : null;
}

function parseTitleAndSubtitle(content: string): {
  title: string;
  subtitle: string | null;
} {
  const lines = content.split("\n");
  let title = "";
  let subtitle: string | null = null;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (!title && line.startsWith("# ")) {
      title = line.slice(2).trim();
      continue;
    }
    if (title) {
      const m = line.match(/^\*(.+)\*$|^_(.+)_$/);
      subtitle = m ? (m[1] ?? m[2]).trim() : null;
      break;
    }
  }
  return { title, subtitle };
}

function parseFirstImage(content: string): string | null {
  const match = content.match(/!\[[^\]]*]\(([^)\s]+)(?:\s+["'][^"']*["'])?\)/);
  return match?.[1] ?? null;
}

type BlogFrontmatter = {
  title?: string;
  description?: string;
  date?: string;
  updated?: string;
  image?: string;
  tags?: string[];
};

function cleanScalar(value: string): string {
  const trimmed = value.trim();
  const quoted = trimmed.match(/^["'](.*)["']$/);
  return quoted ? quoted[1] : trimmed;
}

function parseFrontmatterBlock(block: string): BlogFrontmatter {
  const frontmatter: BlogFrontmatter = {};
  const lines = block.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim() || line.trimStart().startsWith("#")) continue;
    const pair = line.match(/^([A-Za-z][A-Za-z0-9_-]*):\s*(.*)$/);
    if (!pair) continue;
    const key = pair[1];
    const value = pair[2];
    if (key === "tags" && !value.trim()) {
      const tags: string[] = [];
      while (i + 1 < lines.length) {
        const next = lines[i + 1];
        const item = next.match(/^\s*-\s+(.+)$/);
        if (!item) break;
        tags.push(cleanScalar(item[1]));
        i += 1;
      }
      frontmatter.tags = tags;
      continue;
    }
    if (key === "tags") {
      const inlineTags = value
        .replace(/^\[/, "")
        .replace(/]$/, "")
        .split(",")
        .map(cleanScalar)
        .filter(Boolean);
      frontmatter.tags = inlineTags;
      continue;
    }
    if (
      key === "title" ||
      key === "description" ||
      key === "date" ||
      key === "updated" ||
      key === "image"
    ) {
      frontmatter[key] = cleanScalar(value);
    }
  }
  return frontmatter;
}

function extractFrontmatter(content: string): {
  body: string;
  frontmatter: BlogFrontmatter;
} {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) return { body: content, frontmatter: {} };
  return {
    body: content.slice(match[0].length),
    frontmatter: parseFrontmatterBlock(match[1]),
  };
}

// Markdown filenames, newest-first. Filename-descending sort means a
// `YYYY-MM-DD-` prefix naturally orders newest-first; without one it is
// alphabetical. Returns [] if the dir is missing.
async function listFiles(): Promise<string[]> {
  try {
    const files = await readdir(BLOG_DIR);
    return files
      .filter((f) => f.toLowerCase().endsWith(".md"))
      .sort()
      .reverse();
  } catch {
    return [];
  }
}

export async function getAllPosts(): Promise<BlogPostMeta[]> {
  const files = await listFiles();
  return Promise.all(
    files.map(async (file) => {
      const content = await readFile(join(BLOG_DIR, file), "utf8");
      const { body, frontmatter } = extractFrontmatter(content);
      const { title, subtitle } = parseTitleAndSubtitle(body);
      const slug = slugFromFile(file);
      const publishedAt =
        normalizeDate(frontmatter.date) ?? publishedAtFromFile(file);
      const image = frontmatter.image ?? parseFirstImage(body);
      return {
        slug,
        title: frontmatter.title || title || slug,
        subtitle: frontmatter.description || subtitle,
        publishedAt,
        updatedAt: revisionDate(frontmatter.updated, publishedAt),
        image: image || null,
        tags: frontmatter.tags ?? [],
      };
    })
  );
}

export async function getAllSlugs(): Promise<string[]> {
  return (await listFiles()).map(slugFromFile);
}

export async function getPost(slug: string): Promise<BlogPost | null> {
  const files = await listFiles();
  const file = files.find((f) => slugFromFile(f) === slug);
  if (!file) return null;
  const content = await readFile(join(BLOG_DIR, file), "utf8");
  const { body, frontmatter } = extractFrontmatter(content);
  const { title, subtitle } = parseTitleAndSubtitle(body);
  const publishedAt =
    normalizeDate(frontmatter.date) ?? publishedAtFromFile(file);
  const image = frontmatter.image ?? parseFirstImage(body);
  return {
    slug,
    title: frontmatter.title || title || slug,
    subtitle: frontmatter.description || subtitle,
    publishedAt,
    updatedAt: revisionDate(frontmatter.updated, publishedAt),
    image: image || null,
    tags: frontmatter.tags ?? [],
    content: body,
  };
}
