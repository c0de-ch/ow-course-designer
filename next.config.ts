import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: ["http://localhost:3000", "http://192.168.79.78:3000"],
  experimental: {
    instrumentationHook: true,
  },
};

export default nextConfig;
