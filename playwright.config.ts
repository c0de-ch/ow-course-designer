import { defineConfig, devices } from "@playwright/test";

const PORT = process.env.E2E_PORT ?? "3100";
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: { timeout: 5_000 },
  // Serial in CI so tests sharing the sqlite test DB don't race.
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // next.config.ts sets output: 'standalone', which means `next start` is
  // inert — use `next dev` for e2e. It's slower to cold-start but serves
  // everything we need and avoids the copy-static-assets dance.
  webServer: {
    command: `yarn dev -p ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      // Separate DB file so e2e doesn't trample the dev DB.
      DATABASE_URL: process.env.DATABASE_URL ?? "file:./e2e.db",
      // NextAuth v5 reads AUTH_URL; v4-legacy envs kept for belt-and-braces.
      AUTH_URL: BASE_URL,
      AUTH_SECRET: process.env.AUTH_SECRET ?? "e2e-secret-do-not-use-in-prod",
      NEXTAUTH_URL: BASE_URL,
      NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET ?? "e2e-secret-do-not-use-in-prod",
      NEXT_PUBLIC_APP_URL: BASE_URL,
      NEXT_PUBLIC_GOOGLE_MAPS_API_KEY:
        process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "e2e-dummy",
    },
  },
});
