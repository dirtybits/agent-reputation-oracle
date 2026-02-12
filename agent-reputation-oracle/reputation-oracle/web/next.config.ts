import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Add unique build ID to force cache invalidation
  generateBuildId: async () => {
    return `marketplace-${Date.now()}`;
  },
};

export default nextConfig;
