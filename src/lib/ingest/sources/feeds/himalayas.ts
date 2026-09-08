import { getJson } from "@/lib/ingest/http";
import { htmlToText } from "@/lib/ingest/html";
import type { FetchContext, RawJob, SourceAdapter } from "@/lib/ingest/types";

/**
 * Himalayas public API — no key. Remote roles, each carrying the countries
 * it is actually open to, which the matcher needs to avoid offering a
 * US-only remote job to someone searching in India.
 *
 *   GET https://himalayas.app/jobs/api?limit=50
 */
interface HimalayasJob {
  guid: string;
  title: string;
  companyName: string;
  companyLogo?: string;
  excerpt?: string;
  description?: string;
  pubDate?: number | string;
  applicationLink?: string;
  locationRestrictions?: string[];
  seniority?: string[];
  categories?: string[];
  minSalary?: number;
  maxSalary?: number;
}

export const himalayas: SourceAdapter = {
  name: "himalayas",
  kind: "feed",

  async fetch({ limit }: FetchContext): Promise<RawJob[]> {
    const body = await getJson<{ jobs?: HimalayasJob[] }>(
      `https://himalayas.app/jobs/api?limit=${Math.min(limit ?? 100, 100)}`,
    );

    return (body.jobs ?? []).map((job) => ({
      source: "himalayas",
      sourceJobId: job.guid,
      url: job.applicationLink ?? job.guid,
      title: job.title,
      companyName: job.companyName,
      companyLogoUrl: job.companyLogo,
      locationsRaw: job.locationRestrictions?.length ? job.locationRestrictions : [],
      isRemoteHint: true,
      descriptionText: htmlToText(job.description ?? job.excerpt),
      departmentRaw: job.categories?.[0],
      salaryMin: job.minSalary,
      salaryMax: job.maxSalary,
      salaryCurrency: job.minSalary ? "USD" : undefined,
      salaryPeriod: job.minSalary ? "year" : undefined,
      tags: job.seniority,
      postedAt: job.pubDate
        ? new Date(typeof job.pubDate === "number" ? job.pubDate * 1000 : job.pubDate)
        : undefined,
    }));
  },
};
