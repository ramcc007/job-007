import type { MetadataRoute } from "next";

import { siteUrl } from "@/lib/site";

/**
 * Only the stable pages. Results are produced live per request, so there are
 * no durable job URLs to list — a deliberate consequence of not keeping a
 * job index.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: siteUrl, changeFrequency: "weekly", priority: 1 },
    { url: `${siteUrl}/jobs`, changeFrequency: "always", priority: 0.8 },
  ];
}
