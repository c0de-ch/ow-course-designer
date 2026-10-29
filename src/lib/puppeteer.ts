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

export async function launchBrowser(extraArgs: string[] = []) {
  const puppeteer = (await import("puppeteer")).default;
  const executablePath = findBrowserExecutable();

  return puppeteer.launch({
    headless: true,
    executablePath,
    args: ["--no-sandbox", "--disable-setuid-sandbox", ...extraArgs],
  });
}

/**
 * Software WebGL, so the vector map (tilt and heading) renders without a GPU:
 * ANGLE on Mesa's llvmpipe through EGL (mesa-egl, mesa-gles and
 * mesa-dri-gallium in the image; Alpine's Chromium has no SwiftShader).
 * PUPPETEER_WEBGL_ARGS (space-separated) overrides it.
 */
export const WEBGL_ARGS = process.env.PUPPETEER_WEBGL_ARGS?.split(/\s+/).filter(Boolean) ?? [
  "--use-gl=angle",
  "--use-angle=gles-egl",
  "--ignore-gpu-blocklist",
];

export class ExportQueueTimeoutError extends Error {
  constructor() {
    super("Export queue timeout");
    this.name = "ExportQueueTimeoutError";
  }
}

const MAX_CONCURRENT_EXPORTS = Number(process.env.PUPPETEER_MAX_CONCURRENCY ?? 2);
const EXPORT_QUEUE_TIMEOUT_MS = Number(process.env.PUPPETEER_QUEUE_TIMEOUT_MS ?? 60_000);

let activeExports = 0;
const waiters: Array<() => void> = [];

function acquireExportSlot(): Promise<void> {
  if (activeExports < MAX_CONCURRENT_EXPORTS) {
    activeExports++;
    return Promise.resolve();
  }

  return new Promise<void>((resolve, reject) => {
    const onAcquire = () => {
      clearTimeout(timer);
      activeExports++;
      resolve();
    };
    const timer = setTimeout(() => {
      const idx = waiters.indexOf(onAcquire);
      if (idx >= 0) waiters.splice(idx, 1);
      reject(new ExportQueueTimeoutError());
    }, EXPORT_QUEUE_TIMEOUT_MS);
    waiters.push(onAcquire);
  });
}

function releaseExportSlot() {
  activeExports--;
  const next = waiters.shift();
  if (next) next();
}

/**
 * Runs a Puppeteer task under a global concurrency cap so concurrent exports
 * cannot exhaust server memory. Throws ExportQueueTimeoutError on saturation.
 */
export async function withBrowser<T>(
  run: (browser: import("puppeteer").Browser) => Promise<T>,
  extraArgs: string[] = []
): Promise<T> {
  await acquireExportSlot();
  try {
    const browser = await launchBrowser(extraArgs);
    try {
      return await run(browser);
    } finally {
      await browser.close();
    }
  } finally {
    releaseExportSlot();
  }
}
