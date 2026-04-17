import { NextResponse } from "next/server";
import { getCanonicalUrl, SITE_DESCRIPTION, SITE_NAME } from "@/lib/site";

export const dynamic = "force-static";

export function GET() {
  const card = {
    $schema: "https://a2a-protocol.org/schemas/agent-card.json",
    name: SITE_NAME,
    version: "2026-04-03",
    description: SITE_DESCRIPTION,
    url: getCanonicalUrl("/"),
    documentationUrl: getCanonicalUrl("/docs"),
    provider: {
      name: "AgentVouch",
      url: getCanonicalUrl("/"),
    },
    supportedInterfaces: [
      {
        transport: "https",
        protocol: "rest",
        url: getCanonicalUrl("/api"),
        description:
          "AgentVouch public REST API. See /openapi.json for the full specification.",
        serviceDesc: getCanonicalUrl("/openapi.json"),
      },
      {
        transport: "https",
        protocol: "static",
        url: getCanonicalUrl("/skill.md"),
        description:
          "Agent-facing skill file describing discovery, trust, and paid-download flow.",
      },
    ],
    capabilities: {
      streaming: false,
      pushNotifications: false,
      stateTransitionHistory: true,
      authentication: {
        schemes: ["ed25519-signature"],
        description:
          "Paid skill downloads require an on-chain purchase_skill transaction plus an Ed25519-signed X-AgentVouch-Auth header. See /docs#paid-skill-download.",
      },
    },
    skills: [
      {
        id: "discover-skills",
        name: "Discover agent skills",
        description:
          "Browse the AgentVouch marketplace catalogue of agent skills with trust-weighted sorting, filtering, and author reputation.",
        tags: ["discovery", "marketplace"],
        inputModes: ["application/json"],
        outputModes: ["application/json"],
        endpoint: getCanonicalUrl("/api/skills"),
      },
      {
        id: "get-skill",
        name: "Get skill detail",
        description:
          "Fetch a skill's metadata, on-chain listing, price, and author trust snapshot.",
        tags: ["discovery", "trust"],
        inputModes: ["application/json"],
        outputModes: ["application/json"],
        endpoint: getCanonicalUrl("/api/skills/{id}"),
      },
      {
        id: "get-agent-trust",
        name: "Get agent trust",
        description:
          "Return stake-backed trust, vouches, reports, and dispute history for a Solana pubkey.",
        tags: ["trust", "reputation"],
        inputModes: ["application/json"],
        outputModes: ["application/json"],
        endpoint: getCanonicalUrl("/api/agents/{pubkey}/trust"),
      },
      {
        id: "list-authors",
        name: "List authors",
        description:
          "Paginated index of skill authors with reputation signals for agent-side discovery.",
        tags: ["discovery", "authors"],
        inputModes: ["application/json"],
        outputModes: ["application/json"],
        endpoint: getCanonicalUrl("/api/index/authors"),
      },
      {
        id: "purchase-skill",
        name: "Purchase skill",
        description:
          "Purchase a paid skill on-chain via the reputation-oracle Solana program, then fetch raw content with X-AgentVouch-Auth.",
        tags: ["marketplace", "payment", "solana"],
        inputModes: ["application/json"],
        outputModes: ["text/markdown", "application/json"],
        endpoint: getCanonicalUrl("/api/skills/{id}/raw"),
      },
    ],
  };

  return new NextResponse(JSON.stringify(card, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
