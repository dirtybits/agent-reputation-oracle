import { NextResponse } from "next/server";
import { getCanonicalUrl } from "@/lib/site";

export const dynamic = "force-static";

type Link = { href: string; type?: string; title?: string };
type LinksetEntry = {
  anchor: string;
  "service-desc"?: Link[];
  "service-doc"?: Link[];
  "service-meta"?: Link[];
  status?: Link[];
  describedby?: Link[];
  alternate?: Link[];
};

export function GET() {
  const abs = (path: string) => getCanonicalUrl(path);

  const linkset: LinksetEntry[] = [
    {
      anchor: abs("/api/skills"),
      "service-desc": [
        {
          href: abs("/openapi.json"),
          type: "application/vnd.oai.openapi+json;version=3.1",
          title: "AgentVouch Public API (OpenAPI 3.1)",
        },
      ],
      "service-doc": [
        { href: abs("/docs"), type: "text/html", title: "AgentVouch docs" },
        {
          href: abs("/skill.md"),
          type: "text/markdown",
          title: "Agent-facing skill file",
        },
      ],
      describedby: [
        {
          href: abs("/.well-known/agentvouch.json"),
          type: "application/json",
          title: "AgentVouch service manifest",
        },
      ],
      alternate: [
        {
          href: abs("/llms.txt"),
          type: "text/plain",
          title: "llms.txt index",
        },
        {
          href: abs("/llms-full.txt"),
          type: "text/plain",
          title: "llms-full.txt expanded index",
        },
      ],
    },
    {
      anchor: abs("/api/agents/{pubkey}/trust"),
      "service-desc": [
        {
          href: abs("/openapi.json"),
          type: "application/vnd.oai.openapi+json;version=3.1",
        },
      ],
      "service-doc": [
        {
          href: abs("/docs/what-is-an-agent-reputation-oracle"),
          type: "text/html",
        },
      ],
    },
    {
      anchor: abs("/api/index/skills"),
      "service-desc": [
        {
          href: abs("/openapi.json"),
          type: "application/vnd.oai.openapi+json;version=3.1",
        },
      ],
      "service-doc": [{ href: abs("/docs"), type: "text/html" }],
    },
    {
      anchor: abs("/api/index/authors"),
      "service-desc": [
        {
          href: abs("/openapi.json"),
          type: "application/vnd.oai.openapi+json;version=3.1",
        },
      ],
      "service-doc": [{ href: abs("/docs"), type: "text/html" }],
    },
    {
      anchor: abs("/api/index/trusted-authors"),
      "service-desc": [
        {
          href: abs("/openapi.json"),
          type: "application/vnd.oai.openapi+json;version=3.1",
        },
      ],
      "service-doc": [{ href: abs("/docs"), type: "text/html" }],
    },
  ];

  return new NextResponse(JSON.stringify({ linkset }, null, 2), {
    headers: {
      "Content-Type": "application/linkset+json; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
