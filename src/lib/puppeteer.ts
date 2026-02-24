import { existsSync } from "fs";

const SYSTEM_CHROME_PATHS = [
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
];

/**
 * Find a Chrome/Chromium executable. Priority:
 * 1. PUPPETEER_EXECUTABLE_PATH env var
 * 2. System-installed Chromium/Chrome
 * 3. undefined (let Puppeteer use its downloaded browser)
 */
export function findBrowserExecutable(): string | undefined {
  const envPath = process.env.PUPPETEER_EXECUTABLE_PATH;
  if (envPath) return envPath;

  for (const p of SYSTEM_CHROME_PATHS) {
    if (existsSync(p)) return p;
  }

  return undefined;
}

export async function launchBrowser() {
  const puppeteer = (await import("puppeteer")).default;
  const executablePath = findBrowserExecutable();

  return puppeteer.launch({
    headless: true,
    executablePath,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
}
