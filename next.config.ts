import type { NextConfig } from 'next';
const config: NextConfig = { experimental: { middlewareClientMaxBodySize: '11mb' } };
export default config;
