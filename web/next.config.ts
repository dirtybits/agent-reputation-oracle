import type { NextConfig } from "next";
import { resolve } from "path";

const nextConfig: NextConfig = {
  turbopack: {
    root: resolve(__dirname),
  },
  generateBuildId: async () => {
    return `marketplace-${Date.now()}`;
  },
};

export default nextConfig;
