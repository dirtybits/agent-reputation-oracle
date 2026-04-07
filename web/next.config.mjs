import { fileURLToPath } from "node:url";

const nextConfig = {
  transpilePackages: ["@agentvouch/protocol"],
  turbopack: {
    root: fileURLToPath(new URL("..", import.meta.url)),
  },
  generateBuildId: async () => `marketplace-${Date.now()}`,
};

export default nextConfig;
