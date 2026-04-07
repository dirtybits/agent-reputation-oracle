const nextConfig = {
  generateBuildId: async () => `marketplace-${Date.now()}`,
};

export default nextConfig;
