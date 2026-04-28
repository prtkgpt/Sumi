import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typedRoutes: false,
  transpilePackages: ['@sumi/db', '@sumi/types'],
};

export default nextConfig;
