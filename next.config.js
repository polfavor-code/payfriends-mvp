/** @type {import('next').NextConfig} */
const nextConfig = {
  // External packages for server components
  experimental: {
    serverComponentsExternalPackages: ['better-sqlite3', 'bcrypt'],
  },
  // Image optimization
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
    ],
  },
};

module.exports = nextConfig;
