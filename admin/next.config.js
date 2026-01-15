const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Ensure we can access the parent directory's database
  experimental: {
    serverComponentsExternalPackages: ['better-sqlite3'],
  },
  // Allow webpack to resolve modules from parent directory (for production calc engine)
  webpack: (config) => {
    config.resolve.modules = [
      ...(config.resolve.modules || []),
      path.resolve(__dirname, '..'),
    ];
    return config;
  },
};

module.exports = nextConfig;
