const agentDiscoveryLinkHeader = [
  '</.well-known/agentvouch.json>; rel="describedby"; type="application/json"',
  '</.well-known/api-catalog>; rel="api-catalog"; type="application/linkset+json"',
  '</.well-known/agent-card.json>; rel="https://a2a-protocol.org/rel/agent-card"; type="application/json"',
  '</.well-known/agent-skills/index.json>; rel="https://agentskills.io/rel/index"; type="application/json"',
  '</openapi.json>; rel="service-desc"; type="application/vnd.oai.openapi+json;version=3.1"',
  '</docs>; rel="service-doc"; type="text/html"',
  '</skill.md>; rel="alternate"; type="text/markdown"',
  '</llms.txt>; rel="alternate"; type="text/plain"',
  '</llms-full.txt>; rel="alternate"; type="text/plain"',
  '</sitemap.xml>; rel="sitemap"; type="application/xml"',
].join(", ");

const nextConfig = {
  generateBuildId: async () => `marketplace-${Date.now()}`,
  async headers() {
    return [
      {
        source: "/",
        headers: [{ key: "Link", value: agentDiscoveryLinkHeader }],
      },
      {
        source: "/docs",
        headers: [{ key: "Link", value: agentDiscoveryLinkHeader }],
      },
      {
        source: "/docs/:path*",
        headers: [{ key: "Link", value: agentDiscoveryLinkHeader }],
      },
      {
        source: "/skills",
        headers: [{ key: "Link", value: agentDiscoveryLinkHeader }],
      },
    ];
  },
};

export default nextConfig;
