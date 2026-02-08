import type { NextConfig } from "next";
import path from 'path';

const nextConfig: NextConfig = {
  // Standalone output for clean deployment
  output: 'standalone',
  
  // Disable ESLint and TypeScript during build (for Vercel deployment)
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  
  // Modern way to exclude packages from client bundle (Next.js 15+)
  serverExternalPackages: ['glob', 'googleapis', 'google-auth-library'],
  
  webpack: (config, { isServer }) => {
    // Ignore problematic modules  
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
    };
    
    // Exclude glob and all its dependencies completely
    config.externals = config.externals || [];
    if (isServer) {
      config.externals.push('glob', 'minipass', 'path-scurry');
    }
    
    return config;
  },
};

export default nextConfig;
