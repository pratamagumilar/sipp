import type { NextConfig } from 'next';
const config: NextConfig = { experimental: { middlewareClientMaxBodySize: '11mb' }, async rewrites() { return [{ source: '/backend/:path*', destination: `${process.env.API_URL || 'http://127.0.0.1:3001'}/:path*` }]; } };
export default config;
