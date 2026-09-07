import { and, eq, lt, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { companies, jobLocations, jobTags, jobs } from "@/lib/db/schema";
import type { NormalizedJob } from "./normalize";
import { slugify } from "./normalize/title";

/** Resolves (or creates) the company row, caching within a single run. */
export class CompanyResolver {
  private readonly cache = new Map<string, number>();

  private key(job: NormalizedJob): string {
    return job.atsPlatform && job.atsSlug
      ? `ats:${job.atsPlatform}:${job.atsSlug}`
      : `name:${job.companyName.toLowerCase()}`;
  }

  async resolve(job: NormalizedJob): Promise<number> {
    const key = this.key(job);
    const cached = this.cache.get(key);
    if (cached) return cached;

    const slug = slugify(job.companyName) || `company-${slugify(key)}`;

    // A company reached through two different ATS platforms, or named
    // slightly differently by two feeds, must still collapse to one row —
    // the slug is what makes that hold.
    const [row] = await db
      .insert(companies)
      .values({
        slug,
        name: job.companyName,
        website: job.companyWebsite,
        logoUrl: job.companyLogoUrl,
        atsPlatform: job.atsPlatform,
        atsSlug: job.atsSlug,
      })
      .onConflictDoUpdate({
        target: companies.slug,
        set: {
          name: sql`excluded.name`,
          // Never overwrite a known logo/site with a null from a poorer source.
          logoUrl: sql`coalesce(excluded.logo_url, ${companies.logoUrl})`,
          website: sql`coalesce(excluded.website, ${companies.website})`,
          atsPlatform: sql`coalesce(excluded.ats_platform, ${companies.atsPlatform})`,
          atsSlug: sql`coalesce(excluded.ats_slug, ${companies.atsSlug})`,
          updatedAt: new Date(),
        },
      })
      .returning({ id: companies.id });

    this.cache.set(key, row!.id);
    return row!.id;
  }
}

export interface UpsertResult {
  inserted: number;
  updated: number;
  seenIds: string[];
}

/** Writes one source's normalised batch, in chunks so a big crawl doesn't
 *  build one enormous statement. */
export async function upsertJobs(
  batch: NormalizedJob[],
  resolver: CompanyResolver,
  now = new Date(),
): Promise<UpsertResult> {
  let inserted = 0;
  let updated = 0;
  const seenIds: string[] = [];

  for (const job of batch) {
    const companyId = await resolver.resolve(job);

    const [row] = await db
      .insert(jobs)
      .values({
        companyId,
        source: job.source,
        sourceJobId: job.sourceJobId,
        externalUrl: job.externalUrl,
        applyUrl: job.applyUrl,
        slug: job.slug,
        title: job.title,
        titleNormalized: job.titleNormalized,
        descriptionExcerpt: job.descriptionExcerpt,
        employmentType: job.employmentType,
        workMode: job.workMode,
        seniority: job.seniority,
        jobFunction: job.jobFunction,
        vertical: job.vertical,
        salaryMin: job.salaryMin?.toString(),
        salaryMax: job.salaryMax?.toString(),
        salaryCurrency: job.salaryCurrency,
        salaryPeriod: job.salaryPeriod,
        postedAt: job.postedAt,
        firstSeenAt: now,
        lastSeenAt: now,
        isActive: true,
        dedupHash: job.dedupHash,
      })
      .onConflictDoUpdate({
        target: [jobs.source, jobs.sourceJobId],
        set: {
          externalUrl: sql`excluded.external_url`,
          applyUrl: sql`excluded.apply_url`,
          title: sql`excluded.title`,
          titleNormalized: sql`excluded.title_normalized`,
          descriptionExcerpt: sql`excluded.description_excerpt`,
          employmentType: sql`excluded.employment_type`,
          workMode: sql`excluded.work_mode`,
          seniority: sql`excluded.seniority`,
          jobFunction: sql`excluded.job_function`,
          vertical: sql`excluded.vertical`,
          salaryMin: sql`excluded.salary_min`,
          salaryMax: sql`excluded.salary_max`,
          salaryCurrency: sql`excluded.salary_currency`,
          salaryPeriod: sql`excluded.salary_period`,
          dedupHash: sql`excluded.dedup_hash`,
          lastSeenAt: sql`excluded.last_seen_at`,
          isActive: sql`true`,
          // posted_at is deliberately NOT refreshed. Sources without a real
          // publication date report "now" on every crawl, which would pin
          // those rows at "posted today" forever and break date sorting.
          // The first value we saw acts as a first-seen date instead.
        },
      })
      .returning({ id: jobs.id, firstSeen: jobs.firstSeenAt });

    if (!row) continue;
    seenIds.push(job.sourceJobId);
    if (row.firstSeen.getTime() === now.getTime()) inserted++;
    else updated++;

    await db.delete(jobLocations).where(eq(jobLocations.jobId, row.id));
    if (job.locations.length) {
      await db.insert(jobLocations).values(
        job.locations.map((l) => ({
          jobId: row.id,
          raw: l.raw,
          city: l.city,
          region: l.region,
          country: l.country,
          countryCode: l.countryCode,
          isRemote: l.isRemote,
        })),
      );
    }

    if (job.tags.length) {
      await db
        .insert(jobTags)
        .values(job.tags.map((tag) => ({ jobId: row.id, tag })))
        .onConflictDoNothing();
    }
  }

  return { inserted, updated, seenIds };
}

/**
 * Retires listings this source no longer returns.
 *
 * Only runs on a clean, non-empty crawl: if a source errored or came back
 * empty, that is far more likely a broken adapter or an outage than every
 * job being filled at once, and deactivating the lot would empty the site.
 */
export async function deactivateMissing(
  source: string,
  seenIds: readonly string[],
  now = new Date(),
): Promise<number> {
  if (seenIds.length === 0) return 0;

  // Every listing this crawl touched had last_seen_at stamped with `now`,
  // so "not seen this run" is simply an older timestamp — no need to send
  // the id list back to Postgres.
  const result = await db
    .update(jobs)
    .set({ isActive: false })
    .where(and(eq(jobs.source, source), eq(jobs.isActive, true), lt(jobs.lastSeenAt, now)))
    .returning({ id: jobs.id });

  return result.length;
}

/** Ages out anything we have not seen in a while, whatever the source. */
export async function expireStale(maxAgeDays = 45): Promise<number> {
  const cutoff = new Date(Date.now() - maxAgeDays * 24 * 60 * 60 * 1000);
  const result = await db
    .update(jobs)
    .set({ isActive: false })
    .where(and(eq(jobs.isActive, true), lt(jobs.lastSeenAt, cutoff)))
    .returning({ id: jobs.id });
  return result.length;
}

