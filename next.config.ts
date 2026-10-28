import type { NextConfig } from "next";
import { readFileSync } from "fs";
import { execSync } from "child_process";

const { version } = JSON.parse(readFileSync("./package.json", "utf-8"));

// CI passes the release tag and commit as build args (see Dockerfile); local
// builds fall back to package.json and the checked-out commit.
const appVersion = (process.env.APP_VERSION || version).replace(/^v/, "");

function gitSha(): string {
  if (process.env.GIT_SHA) return process.env.GIT_SHA;
  try {
    return execSync("git rev-parse HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return "";
  }
}

const devOrigins = ["http://localhost:3000"];
if (process.env.DEV_ORIGIN) devOrigins.push(process.env.DEV_ORIGIN);

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Permissions-Policy",
    value: "camera=(), geolocation=(), microphone=(self)",
  },
];

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: devOrigins,
  env: {
    NEXT_PUBLIC_APP_VERSION: appVersion,
    NEXT_PUBLIC_GIT_SHA: gitSha(),
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
