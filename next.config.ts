import type { NextConfig } from "next";
import { readFileSync } from "fs";

const { version } = JSON.parse(readFileSync("./package.json", "utf-8"));

const devOrigins = ["http://localhost:3000"];
if (process.env.DEV_ORIGIN) devOrigins.push(process.env.DEV_ORIGIN);

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: devOrigins,
  env: {
    NEXT_PUBLIC_APP_VERSION: version,
  },
};

export default nextConfig;
