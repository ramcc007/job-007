import type { MetadataRoute } from "next";
import { desc, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { companies, jobs } from "@/lib/db/schema";
import { siteUrl } from "@/lib/site";

/** Sitemaps cap at 50,000 URLs; stay well inside it and prefer fresh rows. */
const MAX_JOBS = 40_000;

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: siteUrl, changeFrequency: "hourly", priority: 1 },
    { url: `${siteUrl}/jobs`, changeFrequency: "hourly", priority: 0.9 },
    { url: `${siteUrl}/companies`, changeFrequency: "daily", priority: 0.6 },
  ];

  // The sitemap is prerendered at build time, when the database may not be
  // reachable yet. Falling back to the static routes keeps the build green
  // and the route serving something valid.
  let jobRows: { slug: string; postedAt: Date; lastSeenAt: Date }[] = [];
  let companyRows: { slug: string; updatedAt: Date }[] = [];
  try {
    [jobRows, companyRows] = await Promise.all([
    db
      .select({ slug: jobs.slug, postedAt: jobs.postedAt, lastSeenAt: jobs.lastSeenAt })
      .from(jobs)
      .where(eq(jobs.isActive, true))
      .orderBy(desc(jobs.postedAt))
      .limit(MAX_JOBS),
      db.select({ slug: companies.slug, updatedAt: companies.updatedAt }).from(companies).limit(5000),
    ]);
  } catch (err) {
    console.error("sitemap: database unavailable, serving static routes only", err);
    return staticRoutes;
  }

  return [
    ...staticRoutes,
    ...jobRows.map((row) => ({
      url: `${siteUrl}/jobs/${row.slug}`,
      lastModified: row.lastSeenAt,
      changeFrequency: "daily" as const,
      priority: 0.8,
    })),
    ...companyRows.map((row) => ({
      url: `${siteUrl}/companies/${row.slug}`,
      lastModified: row.updatedAt,
      changeFrequency: "daily" as const,
      priority: 0.5,
    })),
  ];
}
