/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },
  // Désactiver les routes API Next.js puisque nous utilisons Express
  async rewrites() {
    return [];
  },
};

export default nextConfig;
