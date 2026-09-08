import { getJson } from "@/lib/ingest/http";
import { htmlToText } from "@/lib/ingest/html";
import type { FetchContext, RawJob, SourceAdapter } from "@/lib/ingest/types";

/**
 * Arbeitnow public job board API — no key, strong European coverage.
 *   GET https://www.arbeitnow.com/api/job-board-api
 * Paginated via `links.next`; pages are walked until the cap is reached.
 */
interface ArbeitnowJob {
  slug: string;
  company_name: string;
  title: string;
  description?: string;
  remote?: boolean;
  url: string;
  tags?: string[];
  job_types?: string[];
  location?: string;
  created_at?: number;
}

const MAX_PAGES = 5;

export const arbeitnow: SourceAdapter = {
  name: "arbeitnow",
  kind: "feed",
  // German-language board: strong across DACH and neighbouring markets,
  // essentially empty elsewhere, so it is skipped for other countries.
  countries: ["DE", "AT", "CH", "NL", "BE", "PL", "CZ"],

  async fetch({ limit }: FetchContext): Promise<RawJob[]> {
    const out: RawJob[] = [];
    let next: string | undefined = "https://www.arbeitnow.com/api/job-board-api";

    for (let page = 0; page < MAX_PAGES && next; page++) {
      const body: { data?: ArbeitnowJob[]; links?: { next?: string | null } } =
        await getJson(next);

      for (const job of body.data ?? []) {
        out.push({
          source: "arbeitnow",
          sourceJobId: job.slug,
          url: job.url,
          title: job.title,
          companyName: job.company_name,
          locationsRaw: job.location ? [job.location] : [],
          isRemoteHint: job.remote,
          descriptionText: htmlToText(job.description),
          employmentTypeRaw: job.job_types?.[0],
          tags: job.tags,
          postedAt: job.created_at ? new Date(job.created_at * 1000) : undefined,
        });

        if (limit && out.length >= limit) return out;
      }

      next = body.links?.next ?? undefined;
    }

    return out;
  },
};
