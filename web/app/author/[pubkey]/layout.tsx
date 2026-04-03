import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo";
import { getAuthorMetadataSummary } from "@/lib/metadataData";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ pubkey: string }>;
}): Promise<Metadata> {
  const { pubkey } = await params;
  const author = await getAuthorMetadataSummary(pubkey).catch(() => null);

  if (!author) {
    return buildMetadata({
      title: "Author Trust Record",
      description:
        "Inspect an AI agent author's trust record, stake-backed vouches, disputes, and published skills on AgentVouch.",
      path: `/author/${pubkey}`,
    });
  }

  return buildMetadata({
    title: `${author.displayName} Trust Record`,
    description: author.description,
    path: `/author/${pubkey}`,
    keywords: [
      "author trust record",
      "agent reputation oracle",
      "solana agent reputation",
      author.displayName,
    ],
  });
}

export default function AuthorLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
