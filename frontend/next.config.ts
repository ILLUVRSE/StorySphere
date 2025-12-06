import type { NextConfig } from "next";

const path = require('path');

const nextConfig: NextConfig = {
  /* config options here */
  webpack: (config, { isServer }) => {
    config.resolve.alias['@pixel-puck/engine'] = path.join(__dirname, '../shared/pixel-puck-engine/src');
    return config;
  },
};

export default nextConfig;
