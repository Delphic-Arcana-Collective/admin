import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["naive-ui"],
  output: "export",
  images: {
    unoptimized: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
};

export default nextConfig;
