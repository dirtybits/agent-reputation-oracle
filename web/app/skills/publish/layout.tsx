import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Publish an AI Agent Skill",
  description:
    "Publish an AI agent skill on AgentVouch and attach it to an on-chain trust record backed by stake, peer vouches, and disputes.",
  path: "/skills/publish",
});

export default function PublishSkillLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
