import type { MetadataRoute } from "next";

import { siteUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Filtered permutations are near-duplicates; letting crawlers loose
        // on them wastes crawl budget that should go to job pages.
        // Live search costs a real fan-out per request; crawlers must not
        // trigger it, and there is nothing stable there to index anyway.
        disallow: ["/jobs", "/api/"],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
