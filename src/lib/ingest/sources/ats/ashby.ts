import { getJson, mapPool } from "@/lib/ingest/http";
import type { FetchContext, RawJob, SourceAdapter } from "@/lib/ingest/types";

/**
 * Ashby job board API — public, no key.
 *   GET https://api.ashbyhq.com/posting-api/job-board/{slug}?includeCompensation=true
 *
 * `isListed: false` marks postings the employer has hidden from their own
 * board, so those are skipped rather than surfaced.
 */
interface AshbyJob {
  id: string;
  title: string;
  location?: string;
  secondaryLocations?: { location?: string }[];
  department?: string;
  team?: string;
  isListed?: boolean;
  isRemote?: boolean;
  descriptionPlain?: string;
  publishedAt?: string;
  employmentType?: string;
  jobUrl?: string;
  applyUrl?: string;
  compensation?: {
    compensationTierSummary?: string;
    summaryComponents?: {
      compensationType?: string;
      interval?: string;
      currencyCode?: string;
      minValue?: number;
      maxValue?: number;
    }[];
  };
}

export const ashby: SourceAdapter = {
  name: "ashby",
  kind: "ats",

  async fetch({ seeds, limit, log }: FetchContext): Promise<RawJob[]> {
    const out: RawJob[] = [];

    const results = await mapPool(seeds, 4, async (seed) => {
      const url = `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(seed.slug)}?includeCompensation=true`;
      const body = await getJson<{ jobs?: AshbyJob[] }>(url);
      return { seed, jobs: body.jobs ?? [] };
    });

    for (const result of results) {
      if (result.status === "rejected") {
        log(`ashby: ${String(result.reason)}`);
        continue;
      }
      const { seed, jobs } = result.value;

      for (const job of jobs) {
        if (job.isListed === false) continue;

        // Prefer a salary component over a bonus/equity one.
        const pay = job.compensation?.summaryComponents?.find(
          (c) => c.compensationType === "Salary",
        ) ?? job.compensation?.summaryComponents?.[0];

        const locations = [
          job.location,
          ...(job.secondaryLocations ?? []).map((l) => l.location),
        ].filter((v): v is string => Boolean(v && v.trim()));

        out.push({
          source: "ashby",
          sourceJobId: job.id,
          url: job.jobUrl ?? job.applyUrl ?? "",
          applyUrl: job.applyUrl,
          title: job.title,
          companyName: seed.name ?? seed.slug,
          atsPlatform: "ashby",
          atsSlug: seed.slug,
          locationsRaw: [...new Set(locations)],
          isRemoteHint: job.isRemote,
          descriptionText: job.descriptionPlain,
          employmentTypeRaw: job.employmentType,
          departmentRaw: job.department ?? job.team,
          salaryMin: pay?.minValue,
          salaryMax: pay?.maxValue,
          salaryCurrency: pay?.currencyCode,
          salaryPeriod: pay?.interval?.replace(/^per/i, "").toLowerCase() || undefined,
          salaryRaw: job.compensation?.compensationTierSummary,
          postedAt: job.publishedAt ? new Date(job.publishedAt) : undefined,
        });

        if (limit && out.length >= limit) return out;
      }
    }

    return out;
  },
};
