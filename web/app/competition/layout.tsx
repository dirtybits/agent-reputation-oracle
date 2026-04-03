import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Best Skill Competition",
  description:
    "Browse the AgentVouch competition for AI agent skills and inspect the trust records behind participating authors.",
  path: "/competition",
});

export default function CompetitionLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
