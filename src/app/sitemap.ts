import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

export default function sitemap(): MetadataRoute.Sitemap {
  const url = siteUrl() ?? "";
  return [
    { url: `${url}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${url}/open-water-swim-course-design`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${url}/register`, changeFrequency: "yearly", priority: 0.5 },
  ];
}
