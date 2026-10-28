import { runtimeEnv } from "@/lib/app-url";

export const SITE_NAME = "OW Course Designer";

export const SITE_DESCRIPTION =
  "Free open water swimming course designer: plan swim courses on satellite maps, place turn buoys, " +
  "start and finish, feeding platforms and rescue zones, get the exact distance per lap and share " +
  "the course with swimmers, officials and safety crews. For open water races, marathon swimming, " +
  "triathlon swim legs and club training.";

export const SITE_KEYWORDS = [
  "open water swimming",
  "open water swim course",
  "swim course designer",
  "swim course map",
  "open water race planning",
  "marathon swimming",
  "10 km open water",
  "triathlon swim course",
  "buoy placement",
  "turn buoys",
  "feeding platform",
  "swim course distance",
  "lake swim",
  "sea swim",
  "open water event safety",
  "GPX swim course",
];

/**
 * Canonical public origin for links, sitemaps and Open Graph tags: APP_URL at
 * runtime (the image is built once and deployed under different names).
 */
export function siteUrl(): string | null {
  return runtimeEnv("APP_URL")?.replace(/\/+$/, "") ?? null;
}
