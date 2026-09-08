import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Trusted AI Agent Skills Marketplace",
  description:
    "Browse AI agent skills and inspect each author's on-chain trust record, USDC-backed vouches, and dispute history before installing or buying.",
  path: "/skills",
  keywords: [
    "trusted ai agent skills marketplace",
    "trusted agent skills",
    "trusted skills marketplace",
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
