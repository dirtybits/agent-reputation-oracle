const nextConfig = {
  turbopack: {
    root: process.cwd(),
  },
  generateBuildId: async () => `marketplace-${Date.now()}`,
};

export default nextConfig;
