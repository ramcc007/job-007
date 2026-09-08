import { getJson } from "@/lib/ingest/http";
import type { FetchContext, RawJob, SourceAdapter } from "@/lib/ingest/types";

/**
 * JSearch, via RapidAPI — a licensed aggregator that indexes Indeed,
 * LinkedIn, Glassdoor, ZipRecruiter and Google for Jobs.
 *
 * This is how those listings can be surfaced lawfully. Scraping the sites
 * directly is forbidden by their terms and defeated by their bot defences;
 * JSearch pays for the feed and exposes it under an API contract. Each
 * listing keeps its `job_publisher`, so a result sourced from Indeed is
 * labelled as such rather than passed off as ours.
 *
 * Free tier available at rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch.
 */
interface JSearchJob {
  job_id: string;
  job_title: string;
  employer_name?: string;
  employer_logo?: string;
  employer_website?: string;
  job_publisher?: string;
  job_apply_link?: string;
  job_description?: string;
  job_is_remote?: boolean;
  job_employment_type?: string;
  job_city?: string;
  job_state?: string;
  job_country?: string;
  job_posted_at_datetime_utc?: string;
  job_min_salary?: number;
  job_max_salary?: number;
  job_salary_currency?: string;
  job_salary_period?: string;
}

const PAGES = 2;

export const jsearch: SourceAdapter = {
  name: "jsearch",
  kind: "feed",

  unavailableReason() {
    return process.env.RAPIDAPI_KEY
      ? null
      : "RAPIDAPI_KEY not set — free tier at rapidapi.com covers Indeed, LinkedIn and Glassdoor listings";
  },

  async fetch({ limit, query, log }: FetchContext): Promise<RawJob[]> {
    const key = process.env.RAPIDAPI_KEY!;
    const out: RawJob[] = [];

    // JSearch expects one natural-language query rather than separate
    // keyword and place fields.
    const phrase = [query?.text, query?.location].filter(Boolean).join(" in ");
    if (!phrase) return [];

    for (let page = 1; page <= PAGES; page++) {
      const params = new URLSearchParams({
        query: phrase,
        page: String(page),
        num_pages: "1",
      });
      if (query?.country) params.set("country", query.country.toLowerCase());

      let body: { data?: JSearchJob[] };
      try {
        body = await getJson(`https://jsearch.p.rapidapi.com/search?${params}`, {
          headers: {
            "X-RapidAPI-Key": key,
            "X-RapidAPI-Host": "jsearch.p.rapidapi.com",
          },
        });
      } catch (err) {
        log(`jsearch p${page}: ${String(err)}`);
        break;
      }

      const results = body.data ?? [];
      for (const job of results) {
        const place = [job.job_city, job.job_state, job.job_country].filter(Boolean).join(", ");

        out.push({
          source: "jsearch",
          sourceJobId: job.job_id,
          url: job.job_apply_link ?? "",
          title: job.job_title,
          companyName: job.employer_name ?? "Unknown",
          companyWebsite: job.employer_website,
          companyLogoUrl: job.employer_logo,
          locationsRaw: place ? [place] : [],
          isRemoteHint: job.job_is_remote,
          descriptionText: job.job_description,
          employmentTypeRaw: job.job_employment_type,
          salaryMin: job.job_min_salary,
          salaryMax: job.job_max_salary,
          salaryCurrency: job.job_salary_currency,
          salaryPeriod: job.job_salary_period?.toLowerCase(),
          // Keeps the original publisher visible — an Indeed listing stays
          // attributed to Indeed.
          tags: job.job_publisher ? [job.job_publisher] : undefined,
          postedAt: job.job_posted_at_datetime_utc
            ? new Date(job.job_posted_at_datetime_utc)
            : undefined,
        });

        if (limit && out.length >= limit) return out;
      }
      if (results.length === 0) break;
    }

    return out;
  },
};
