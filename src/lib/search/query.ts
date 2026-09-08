import { and, asc, desc, eq, gte, ilike, inArray, or, sql, type SQL } from "drizzle-orm";

import type { AnyPgColumn } from "drizzle-orm/pg-core";

import { getDb } from "@/lib/db";
import { companies, jobLocations, jobs } from "@/lib/db/schema";

export interface SearchParams {
  q?: string;
  location?: string;
  country?: string;
  workMode?: string;
  jobFunction?: string;
  vertical?: string;
  seniority?: string;
  employmentType?: string;
  source?: string;
  company?: string;
  /** Max age in days. */
  posted?: number;
  salaryMin?: number;
  sort?: "recent" | "relevance" | "salary";
  page?: number;
  perPage?: number;
}

export interface JobResult {
  id: number;
  slug: string;
  title: string;
  externalUrl: string;
  applyUrl: string | null;
  descriptionExcerpt: string | null;
  workMode: string | null;
  jobFunction: string | null;
  vertical: string | null;
  seniority: string | null;
  employmentType: string | null;
  salaryMin: string | null;
  salaryMax: string | null;
  salaryCurrency: string | null;
  salaryPeriod: string | null;
  postedAt: Date;
  source: string;
  companyName: string;
  companySlug: string;
  companyLogoUrl: string | null;
  locationLabel: string | null;
  isRemote: boolean;
  /** Other sources carrying the same role. */
  alsoOn: string[];
}

export const PER_PAGE = 25;

/**
 * The location a card shows. A posting can list several offices; the first
 * is the primary one, and the count of the rest becomes "+2 more".
 */
const locationLabelSql = sql<string | null>`(
  select case
    when count(*) = 0 then null
    when bool_and(l.is_remote) and max(coalesce(l.city, '')) = '' then 'Remote'
    else min(coalesce(nullif(l.city, ''), nullif(l.country, ''), 'Remote'))
         || case when count(*) > 1 then ' +' || (count(*) - 1) else '' end
  end
  from job_locations l where l.job_id = ${jobs.id}
)`;

const isRemoteSql = sql<boolean>`exists (
  select 1 from job_locations l where l.job_id = ${jobs.id} and l.is_remote
)`;

/** Builds every WHERE clause, optionally leaving one out so a facet can
 *  count its own alternatives without excluding them. */
function buildConditions(params: SearchParams, exclude?: keyof SearchParams): SQL[] {
  const conditions: SQL[] = [eq(jobs.isActive, true)];
  const on = (key: keyof SearchParams) => key !== exclude;

  if (params.q && on("q")) {
    const text = params.q.trim();
    if (text) {
      conditions.push(
        or(
          sql`jobs.search_vector @@ websearch_to_tsquery('english', ${text})`,
          ilike(companies.name, `%${text}%`),
        )!,
      );
    }
  }

  if (params.location && on("location")) {
    const text = params.location.trim();
    conditions.push(
      sql`exists (
        select 1 from job_locations l
        where l.job_id = ${jobs.id}
          and (l.city ilike ${`%${text}%`} or l.country ilike ${`%${text}%`}
               or l.region ilike ${`%${text}%`} or l.raw ilike ${`%${text}%`})
      )`,
    );
  }

  if (params.country && on("country")) {
    conditions.push(
      sql`exists (select 1 from job_locations l where l.job_id = ${jobs.id} and l.country_code = ${params.country})`,
    );
  }

  if (params.workMode && on("workMode")) conditions.push(eq(jobs.workMode, params.workMode));
  if (params.jobFunction && on("jobFunction")) conditions.push(eq(jobs.jobFunction, params.jobFunction));
  if (params.vertical && on("vertical")) conditions.push(eq(jobs.vertical, params.vertical));
  if (params.seniority && on("seniority")) conditions.push(eq(jobs.seniority, params.seniority));
  if (params.employmentType && on("employmentType")) conditions.push(eq(jobs.employmentType, params.employmentType));
  if (params.source && on("source")) conditions.push(eq(jobs.source, params.source));
  if (params.company && on("company")) conditions.push(eq(companies.slug, params.company));

  if (params.posted && on("posted")) {
    const cutoff = new Date(Date.now() - params.posted * 24 * 60 * 60 * 1000);
    conditions.push(gte(jobs.postedAt, cutoff));
  }

  if (params.salaryMin && on("salaryMin")) {
    // Compare against the top of the range: a role paying "80k–120k"
    // should surface for someone filtering at 100k.
    conditions.push(sql`coalesce(${jobs.salaryMax}, ${jobs.salaryMin}) >= ${params.salaryMin}`);
  }

  return conditions;
}

function orderFor(params: SearchParams): SQL[] {
  if (params.sort === "salary") {
    return [sql`coalesce(${jobs.salaryMax}, ${jobs.salaryMin}) desc nulls last`, desc(jobs.postedAt)];
  }
  if (params.sort === "relevance" && params.q?.trim()) {
    return [
      sql`ts_rank(jobs.search_vector, websearch_to_tsquery('english', ${params.q.trim()})) desc`,
      desc(jobs.postedAt),
    ];
  }
  return [desc(jobs.postedAt), desc(jobs.id)];
}

export interface SearchResponse {
  jobs: JobResult[];
  total: number;
  page: number;
  perPage: number;
}

export async function searchJobs(params: SearchParams): Promise<SearchResponse> {
  const db = await getDb();
  const perPage = params.perPage ?? PER_PAGE;
  const page = Math.max(1, params.page ?? 1);
  const conditions = buildConditions(params);

  const rows = await db
    .select({
      id: jobs.id,
      slug: jobs.slug,
      title: jobs.title,
      externalUrl: jobs.externalUrl,
      applyUrl: jobs.applyUrl,
      descriptionExcerpt: jobs.descriptionExcerpt,
      workMode: jobs.workMode,
      jobFunction: jobs.jobFunction,
      vertical: jobs.vertical,
      seniority: jobs.seniority,
      employmentType: jobs.employmentType,
      salaryMin: jobs.salaryMin,
      salaryMax: jobs.salaryMax,
      salaryCurrency: jobs.salaryCurrency,
      salaryPeriod: jobs.salaryPeriod,
      postedAt: jobs.postedAt,
      source: jobs.source,
      dedupHash: jobs.dedupHash,
      companyName: companies.name,
      companySlug: companies.slug,
      companyLogoUrl: companies.logoUrl,
      locationLabel: locationLabelSql,
      isRemote: isRemoteSql,
      total: sql<number>`count(*) over ()`,
    })
    .from(jobs)
    .innerJoin(companies, eq(companies.id, jobs.companyId))
    .where(and(...conditions))
    .orderBy(...orderFor(params))
    .limit(perPage)
    .offset((page - 1) * perPage);

  const total = rows.length ? Number(rows[0]!.total) : 0;

  // "Also on Lever, RemoteOK" — one extra query rather than N.
  const hashes = [...new Set(rows.map((r) => r.dedupHash))];
  const alsoOn = new Map<string, string[]>();
  if (hashes.length) {
    const siblings = await db
      .select({ dedupHash: jobs.dedupHash, source: jobs.source })
      .from(jobs)
      .where(and(inArray(jobs.dedupHash, hashes), eq(jobs.isActive, true)));
    for (const row of siblings) {
      const list = alsoOn.get(row.dedupHash) ?? [];
      if (!list.includes(row.source)) list.push(row.source);
      alsoOn.set(row.dedupHash, list);
    }
  }

  return {
    total,
    page,
    perPage,
    jobs: rows.map(({ total: _t, dedupHash, ...row }) => ({
      ...row,
      alsoOn: (alsoOn.get(dedupHash) ?? []).filter((s) => s !== row.source),
    })),
  };
}

export interface FacetBucket {
  value: string;
  count: number;
}

/**
 * Counts for one facet, with that facet's own filter lifted — so choosing
 * "Remote" still shows how many Hybrid roles the rest of the filters match,
 * instead of collapsing every other option to zero.
 */
async function facetCounts(
  params: SearchParams,
  column: AnyPgColumn,
  key: keyof SearchParams,
): Promise<FacetBucket[]> {
  const db = await getDb();
  const conditions = buildConditions(params, key);
  const rows = await db
    .select({ value: sql<string | null>`${column}`, count: sql<number>`count(*)::int` })
    .from(jobs)
    .innerJoin(companies, eq(companies.id, jobs.companyId))
    .where(and(...conditions))
    .groupBy(column)
    .orderBy(desc(sql`count(*)`));

  return rows
    .filter((r): r is { value: string; count: number } => Boolean(r.value))
    .map((r) => ({ value: r.value, count: Number(r.count) }));
}

export interface Facets {
  workMode: FacetBucket[];
  jobFunction: FacetBucket[];
  vertical: FacetBucket[];
  seniority: FacetBucket[];
  employmentType: FacetBucket[];
  source: FacetBucket[];
  country: FacetBucket[];
}

export async function loadFacets(params: SearchParams): Promise<Facets> {
  const db = await getDb();
  const countryConditions = buildConditions(params, "country");
  const [workMode, jobFunction, vertical, seniority, employmentType, source, countryRows] =
    await Promise.all([
      facetCounts(params, jobs.workMode, "workMode"),
      facetCounts(params, jobs.jobFunction, "jobFunction"),
      facetCounts(params, jobs.vertical, "vertical"),
      facetCounts(params, jobs.seniority, "seniority"),
      facetCounts(params, jobs.employmentType, "employmentType"),
      facetCounts(params, jobs.source, "source"),
      db
        // GROUP BY already collapses to one row per country; adding
        // DISTINCT on top makes Postgres reject the ORDER BY aggregate.
        .select({
          value: jobLocations.countryCode,
          count: sql<number>`count(distinct ${jobs.id})::int`,
        })
        .from(jobs)
        .innerJoin(companies, eq(companies.id, jobs.companyId))
        .innerJoin(jobLocations, eq(jobLocations.jobId, jobs.id))
        .where(and(...countryConditions, sql`${jobLocations.countryCode} is not null`))
        .groupBy(jobLocations.countryCode)
        .orderBy(desc(sql`count(distinct ${jobs.id})`)),
    ]);

  return {
    workMode, jobFunction, vertical, seniority, employmentType, source,
    country: countryRows
      .filter((r): r is { value: string; count: number } => Boolean(r.value))
      .map((r) => ({ value: r.value, count: Number(r.count) })),
  };
}

export async function getJobBySlug(slug: string) {
  const db = await getDb();
  const [row] = await db
    .select({
      id: jobs.id, slug: jobs.slug, title: jobs.title, externalUrl: jobs.externalUrl,
      applyUrl: jobs.applyUrl, descriptionExcerpt: jobs.descriptionExcerpt,
      workMode: jobs.workMode, jobFunction: jobs.jobFunction, vertical: jobs.vertical,
      seniority: jobs.seniority, employmentType: jobs.employmentType,
      salaryMin: jobs.salaryMin, salaryMax: jobs.salaryMax,
      salaryCurrency: jobs.salaryCurrency, salaryPeriod: jobs.salaryPeriod,
      postedAt: jobs.postedAt, source: jobs.source, isActive: jobs.isActive,
      companyName: companies.name, companySlug: companies.slug,
      companyLogoUrl: companies.logoUrl, companyWebsite: companies.website,
      locationLabel: locationLabelSql, isRemote: isRemoteSql,
    })
    .from(jobs)
    .innerJoin(companies, eq(companies.id, jobs.companyId))
    .where(eq(jobs.slug, slug))
    .limit(1);

  if (!row) return null;

  const locations = await db
    .select()
    .from(jobLocations)
    .where(eq(jobLocations.jobId, row.id))
    .orderBy(asc(jobLocations.id));

  return { ...row, locations };
}

export async function getCompanyBySlug(slug: string) {
  const db = await getDb();
  const [row] = await db.select().from(companies).where(eq(companies.slug, slug)).limit(1);
  return row ?? null;
}

export async function countActiveJobs(): Promise<number> {
  const db = await getDb();
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(jobs)
    .where(eq(jobs.isActive, true));
  return Number(row?.count ?? 0);
}
