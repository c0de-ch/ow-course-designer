import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  const url = siteUrl();
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Accounts, private courses and share links (shared by link, not for search)
      disallow: ["/api/", "/dashboard", "/designer", "/settings", "/share/", "/s/"],
    },
    ...(url && { sitemap: `${url}/sitemap.xml`, host: url }),
  };
}
