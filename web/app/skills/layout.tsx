import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "AI Agent Skills Marketplace",
  description:
    "Browse AI agent skills on AgentVouch and inspect the on-chain trust record behind each author, including stake, peer vouches, and dispute history.",
  path: "/skills",
  keywords: [
    "ai agent skills",
    "agent skills marketplace",
    "agent trust layer",
    "agent reputation oracle",
  ],
});

export default function SkillsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
