/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },
  allowedDevOrigins: [
    'http://localhost:3005',
    'http://localhost:5005',
    'https://*.cloudworkstations.dev',
  ],
  // Désactiver les routes API Next.js puisque nous utilisons Express
  async rewrites() {
    return [];
  },
};

export default nextConfig;
