// Next.js inlines process.env.NEXT_PUBLIC_* at build time, also in server code,
// so the Docker image would carry the build placeholder. A computed name is
// read from the runtime environment instead.
export function runtimeEnv(name: string): string | undefined {
  return process.env[name] || process.env[`NEXT_PUBLIC_${name}`] || undefined;
}

/**
 * Public base URL for links handed to users (share links, flyover videos):
 * APP_URL (or NEXT_PUBLIC_APP_URL) when set, else the origin of the request,
 * honouring X-Forwarded-* from the proxy in front of the app.
 */
export function publicAppUrl(req?: Request): string {
  const configured = runtimeEnv("APP_URL");
  if (configured) return configured.replace(/\/+$/, "");
  if (req) {
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
    if (host) {
      const proto =
        req.headers.get("x-forwarded-proto")?.split(",")[0].trim() ??
        new URL(req.url).protocol.replace(":", "");
      return `${proto}://${host}`;
    }
  }
  return "http://localhost:3000";
}

/**
 * Base URL Puppeteer uses to render print views. It runs next to the server,
 * so it talks to it directly rather than through the public hostname.
 */
export function internalAppUrl(): string {
  return (
    process.env.INTERNAL_APP_URL?.replace(/\/+$/, "") ??
    `http://localhost:${process.env.PORT ?? 3000}`
  );
}
