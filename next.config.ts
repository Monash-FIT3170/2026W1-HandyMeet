import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  reactCompiler: true,
  allowedDevOrigins: ['*.lhr.life'],
};

export default nextConfig;
