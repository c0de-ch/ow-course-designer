import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: ["http://localhost:3000"],
  experimental: {
    instrumentationHook: true,
  },
};

export default nextConfig;
