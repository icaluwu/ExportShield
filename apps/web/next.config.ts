import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  poweredByHeader: false,
  transpilePackages: ["@exportshield/shared", "@exportshield/contract-config"],
};

export default nextConfig;
