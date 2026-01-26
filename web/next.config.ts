import type { NextConfig } from "next";
import path from 'path';

const nextConfig: NextConfig = {
  // Fix for multiple lockfiles warning
  outputFileTracingRoot: path.join(__dirname, '../'),
  
  experimental: {
    serverComponentsExternalPackages: ['glob', 'googleapis', 'google-auth-library'],
  },
  
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Add alias for backend code access from API routes
      config.resolve.alias = {
        ...config.resolve.alias,
        '@backend': path.resolve(__dirname, '../src'),
      };
      
      // Allow .js extensions to resolve to .ts files
      config.resolve.extensionAlias = {
        '.js': ['.ts', '.tsx', '.js', '.jsx'],
        '.mjs': ['.mts', '.mjs'],
        '.cjs': ['.cts', '.cjs'],
      };
    } else {
      // Client-side: Don't bundle backend code
      config.resolve.alias = {
        ...config.resolve.alias,
        '@backend': false,
      };
    }
    
    return config;
  },
};

export default nextConfig;
