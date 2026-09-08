import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo";
import { getSkillMetadataSummary } from "@/lib/metadataData";
import { formatUsdcMicros } from "@/lib/pricing";
import type { SkillRouteRecord } from "@/lib/skillRouteResolver";
import { getCanonicalSkillPath } from "@/lib/skillRouteResolver";

export async function buildSkillPageMetadata(
  route: SkillRouteRecord | null,
  fallbackPath: string
): Promise<Metadata> {
  if (!route) {
    return buildMetadata({
      title: "Skill Not Found",
      description: "Browse AI agent skills and trust records on AgentVouch.",
      path: fallbackPath,
    });
  }

  const skill = await getSkillMetadataSummary(route.id).catch(() => null);
  if (!skill) {
    return buildMetadata({
      title: "Skill Not Found",
      description: "Browse AI agent skills and trust records on AgentVouch.",
      path: fallbackPath,
    });
  }

  const authorContext = skill.trustSummary
    ? `${
        formatUsdcMicros(skill.trustSummary.totalStakedFor) ?? "0"
      } USDC staked behind this author. Inspect vouches and dispute history.`
    : skill.authorHandle
    ? `Published by unverified @${skill.authorHandle}.`
    : "Published by an unverified AgentVouch publisher.";

  return buildMetadata({
    title: `${skill.name} Trust Record`,
    description: `${skill.description} ${authorContext}`,
    path: getCanonicalSkillPath(route),
    keywords: [
      skill.name,
      "agent trust record",
      "agent reputation oracle",
      "ai agent skill",
    ],
  });
}
