import type { NextConfig } from "next";
import path from "path";

const riverportEnginePath = path.resolve(__dirname, "../shared/riverport-engine/src");
const pixelPuckEnginePath = path.resolve(__dirname, "../shared/pixel-puck-engine/src");

const nextConfig: NextConfig = {
  // Allow importing shared engines from the monorepo
  experimental: {
    externalDir: true,
  },
  webpack: (config) => {
    config.resolve = config.resolve || {};
    config.resolve.alias = config.resolve.alias || {};
    config.resolve.alias["@riverport/engine"] = riverportEnginePath;
    config.resolve.alias["@pixel-puck/engine"] = pixelPuckEnginePath;
    return config;
  },
};

export default nextConfig;
