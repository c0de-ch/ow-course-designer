import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

// Allowlisted origins for Google Maps + Places (New) API.
// Keep this tight — every new external dep adds attack surface.
const GOOGLE_MAPS_SCRIPT = [
  "https://maps.googleapis.com",
  "https://maps.gstatic.com",
];
const GOOGLE_MAPS_IMG = [
  "https://maps.googleapis.com",
  "https://maps.gstatic.com",
  "https://*.googleusercontent.com",
  "https://*.ggpht.com",
  "https://streetviewpixels-pa.googleapis.com",
];
const GOOGLE_MAPS_CONNECT = [
  "https://maps.googleapis.com",
  "https://places.googleapis.com",
];

function buildCsp(nonce: string): string {
  const self = "'self'";
  const isDev = process.env.NODE_ENV !== "production";

  const directives: Record<string, string[]> = {
    "default-src": [self],
    "script-src": [
      self,
      `'nonce-${nonce}'`,
      "'strict-dynamic'",
      // Next.js dev HMR and some runtime pieces still rely on eval.
      ...(isDev ? ["'unsafe-eval'"] : []),
      ...GOOGLE_MAPS_SCRIPT,
    ],
    // Tailwind + Ripple UI emit inline styles at runtime; hashing them is
    // impractical. 'unsafe-inline' for styles is the accepted tradeoff.
    "style-src": [self, "'unsafe-inline'", "https://fonts.googleapis.com"],
    "img-src": [self, "data:", "blob:", ...GOOGLE_MAPS_IMG],
    "font-src": [self, "https://fonts.gstatic.com", "data:"],
    "connect-src": [self, ...GOOGLE_MAPS_CONNECT],
    "frame-src": [self, "https://accounts.google.com"],
    "media-src": [self, "blob:"],
    "worker-src": [self, "blob:"],
    "object-src": ["'none'"],
    "base-uri": [self],
    "form-action": [self, "https://accounts.google.com"],
    "frame-ancestors": ["'none'"],
    "upgrade-insecure-requests": [],
  };

  return Object.entries(directives)
    .map(([k, v]) => (v.length ? `${k} ${v.join(" ")}` : k))
    .join("; ");
}

// Paths that require a signed-in user. Mirror the list in auth.ts's
// authorized() callback — the wrapped `auth(fn)` form below bypasses that
// callback, so we check here instead.
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/designer",
  "/settings",
  "/api/courses",
  "/api/account",
];

export default auth((req) => {
  const pathname = req.nextUrl.pathname;
  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));

  if (isProtected && !req.auth) {
    const signInUrl = new URL("/login", req.nextUrl.origin);
    signInUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(signInUrl);
  }

  const nonce = crypto.randomUUID().replace(/-/g, "");
  const csp = buildCsp(nonce);

  // Next.js picks up the nonce from x-nonce on the request headers and
  // applies it to any inline scripts it emits during SSR.
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  // Report-Only during rollout: violations are logged but nothing breaks.
  // Flip to "Content-Security-Policy" once the report stream is clean.
  response.headers.set("Content-Security-Policy-Report-Only", csp);
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(self)"
  );

  return response;
});

export const config = {
  // Apply to every page and API route except static assets and image
  // optimizer output (those are served as bytes, not HTML, and don't
  // benefit from CSP).
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|robots.txt|sitemap.xml).*)",
  ],
};
