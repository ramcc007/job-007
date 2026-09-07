import type { MetadataRoute } from "next";
import { desc, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { companies, jobs } from "@/lib/db/schema";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

/** Sitemaps cap at 50,000 URLs; stay well inside it and prefer fresh rows. */
const MAX_JOBS = 40_000;

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [jobRows, companyRows] = await Promise.all([
    db
      .select({ slug: jobs.slug, postedAt: jobs.postedAt, lastSeenAt: jobs.lastSeenAt })
      .from(jobs)
      .where(eq(jobs.isActive, true))
      .orderBy(desc(jobs.postedAt))
      .limit(MAX_JOBS),
    db.select({ slug: companies.slug, updatedAt: companies.updatedAt }).from(companies).limit(5000),
  ]);

  return [
    { url: siteUrl, changeFrequency: "hourly", priority: 1 },
    { url: `${siteUrl}/jobs`, changeFrequency: "hourly", priority: 0.9 },
    { url: `${siteUrl}/companies`, changeFrequency: "daily", priority: 0.6 },
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
