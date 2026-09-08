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

/** ISO country -> the region slug Jobicy expects. */
const GEO_BY_COUNTRY: Record<string, string> = {
  IN: "india", US: "usa", CA: "canada", GB: "uk", IE: "uk",
  AU: "australia", NZ: "new-zealand", PH: "philippines", SG: "apac",
  JP: "apac", HK: "apac", MY: "apac", ID: "apac", TH: "apac", VN: "apac",
  DE: "germany", FR: "france", NL: "europe", ES: "europe", IT: "europe",
  PL: "poland", SE: "europe", NO: "europe", DK: "europe", FI: "europe",
  CH: "europe", AT: "europe", BE: "europe", PT: "europe", CZ: "europe",
  RO: "europe", GR: "europe", UA: "ukraine", BR: "latam", MX: "latam",
  AR: "latam", CL: "latam", CO: "latam", ZA: "emea", AE: "emea", IL: "emea",
};

const num = (v: number | string | undefined): number | undefined => {
  const n = typeof v === "string" ? Number(v) : v;
  return Number.isFinite(n) && n! > 0 ? (n as number) : undefined;
};

export const jobicy: SourceAdapter = {
  name: "jobicy",
  kind: "feed",

  async fetch({ limit, query, log }: FetchContext): Promise<RawJob[]> {
    const count = String(Math.min(limit ?? 50, 50));
    const geo = query?.country ? GEO_BY_COUNTRY[query.country] : undefined;

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
    for (const params of attempts) {
      try {
        body = await getJson<{ jobs?: JobicyJob[] }>(
          `https://jobicy.com/api/v2/remote-jobs?${params}`,
        );
        break;
      } catch (err) {
        log(`jobicy rejected ${params}: ${String(err)}`);
      }
    }
    if (!body) return [];

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
