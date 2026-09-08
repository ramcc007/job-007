import { getJson } from "@/lib/ingest/http";
import { htmlToText } from "@/lib/ingest/html";
import type { FetchContext, RawJob, SourceAdapter } from "@/lib/ingest/types";

/**
 * Jobicy public API — no key, and it filters by region, which is why it is
 * worth having alongside the global remote feeds.
 *
 *   GET https://jobicy.com/api/v2/remote-jobs?count=50&geo=india
 */
interface JobicyJob {
  id: number | string;
  url: string;
  jobTitle: string;
  companyName: string;
  companyLogo?: string;
  jobIndustry?: string[];
  jobType?: string[];
  jobGeo?: string;
  jobLevel?: string;
  jobExcerpt?: string;
  jobDescription?: string;
  pubDate?: string;
  annualSalaryMin?: number | string;
  annualSalaryMax?: number | string;
  salaryCurrency?: string;
}

/**
 * Jobicy validates `geo` against its own list of slugs and rejects anything
 * else outright. Rather than hard-code guesses — which is how this source
 * came to fail with "Invalid 'geo' value" — the list is fetched once and
 * matched against the country being searched.
 */
let geoSlugsPromise: Promise<string[]> | null = null;

async function geoSlugs(): Promise<string[]> {
  geoSlugsPromise ??= getJson<{ locations?: { geoSlug?: string; geoName?: string }[] }>(
    "https://jobicy.com/api/v2/remote-jobs?get=locations",
  )
    .then((body) => (body.locations ?? []).map((l) => l.geoSlug ?? "").filter(Boolean))
    .catch(() => []);
  return geoSlugsPromise;
}

const REGIONS = new Intl.DisplayNames(["en"], { type: "region" });

/** Broader fallbacks for countries Jobicy groups rather than lists. */
const REGION_FALLBACK: Record<string, string[]> = {
  SG: ["apac", "asia"], JP: ["apac", "asia"], HK: ["apac", "asia"],
  MY: ["apac", "asia"], ID: ["apac", "asia"], TH: ["apac", "asia"],
  VN: ["apac", "asia"], PH: ["philippines", "apac", "asia"],
  IE: ["uk", "europe"], NL: ["europe"], ES: ["europe"], IT: ["europe"],
  SE: ["europe"], NO: ["europe"], DK: ["europe"], FI: ["europe"],
  CH: ["europe"], AT: ["europe"], BE: ["europe"], PT: ["europe"],
  CZ: ["europe"], RO: ["europe"], GR: ["europe"], NZ: ["australia"],
  AE: ["emea"], IL: ["emea"], ZA: ["emea"],
  BR: ["latam"], MX: ["latam"], AR: ["latam"], CL: ["latam"], CO: ["latam"],
};

/** Picks a slug Jobicy will actually accept for this country, if any. */
async function resolveGeo(country: string | null | undefined): Promise<string | undefined> {
  if (!country) return undefined;
  const slugs = await geoSlugs();
  if (slugs.length === 0) return undefined;

  let name: string | undefined;
  try { name = REGIONS.of(country) ?? undefined; } catch { name = undefined; }

  const candidates = [
    name?.toLowerCase().replace(/\s+/g, "-"),
    country.toLowerCase(),
    ...(REGION_FALLBACK[country] ?? []),
  ].filter((c): c is string => Boolean(c));

  return candidates.find((candidate) => slugs.includes(candidate));
}

const num = (v: number | string | undefined): number | undefined => {
  const n = typeof v === "string" ? Number(v) : v;
  return Number.isFinite(n) && n! > 0 ? (n as number) : undefined;
};

export const jobicy: SourceAdapter = {
  name: "jobicy",
  kind: "feed",

  async fetch({ limit, query, log }: FetchContext): Promise<RawJob[]> {
    const count = String(Math.min(limit ?? 50, 50));
    const geo = await resolveGeo(query?.country);

    /**
     * Jobicy rejects some filter combinations outright with a 400 rather
     * than returning an empty list, and which combinations are accepted is
     * not documented. Narrowest first, then progressively plainer, so an
     * unsupported filter costs relevance rather than the whole source.
     */
    const attempts: URLSearchParams[] = [];
    if (geo && query?.text) attempts.push(new URLSearchParams({ count, geo, tag: query.text }));
    if (geo) attempts.push(new URLSearchParams({ count, geo }));
    if (query?.text) attempts.push(new URLSearchParams({ count, tag: query.text }));
    attempts.push(new URLSearchParams({ count }));

    let body: { jobs?: JobicyJob[] } | undefined;
    let lastError: unknown;
    for (const params of attempts) {
      try {
        body = await getJson<{ jobs?: JobicyJob[] }>(
          `https://jobicy.com/api/v2/remote-jobs?${params}`,
        );
        break;
      } catch (err) {
        lastError = err;
        log(`jobicy rejected ${params}: ${String(err)}`);
      }
    }
    // Falling back is normal and not a failure; every attempt failing is.
    if (!body) throw lastError ?? new Error("jobicy returned nothing");

    return (body.jobs ?? []).map((job) => ({
      source: "jobicy",
      sourceJobId: String(job.id),
      url: job.url,
      title: job.jobTitle,
      companyName: job.companyName,
      companyLogoUrl: job.companyLogo,
      // jobGeo carries the region the role is open to, which the normaliser
      // reads as the location restriction rather than an office.
      locationsRaw: job.jobGeo ? [job.jobGeo] : [],
      isRemoteHint: true,
      descriptionText: htmlToText(job.jobDescription ?? job.jobExcerpt),
      employmentTypeRaw: job.jobType?.[0],
      departmentRaw: job.jobIndustry?.[0],
      salaryMin: num(job.annualSalaryMin),
      salaryMax: num(job.annualSalaryMax),
      salaryCurrency: job.salaryCurrency,
      salaryPeriod: num(job.annualSalaryMin) ? "year" : undefined,
      tags: job.jobLevel ? [job.jobLevel] : undefined,
      postedAt: job.pubDate ? new Date(job.pubDate) : undefined,
    }));
  },
};
