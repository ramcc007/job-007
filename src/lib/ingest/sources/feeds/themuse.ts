import { getJson } from "@/lib/ingest/http";
import { htmlToText } from "@/lib/ingest/html";
import type { FetchContext, RawJob, SourceAdapter } from "@/lib/ingest/types";

/**
 * The Muse public API — no key required, and it accepts a location filter,
 * so it can be pointed at the city being searched rather than sampled.
 *
 *   GET https://www.themuse.com/api/public/jobs?page=0&location=London%2C%20United%20Kingdom
 */
interface MuseJob {
  id: number;
  name: string;
  contents?: string;
  publication_date?: string;
  locations?: { name: string }[];
  categories?: { name: string }[];
  levels?: { name: string }[];
  company?: { name: string };
  refs?: { landing_page?: string };
  type?: string;
}

const PAGES = 2;

export const themuse: SourceAdapter = {
  name: "themuse",
  kind: "feed",
  // Overwhelmingly North American listings.
  countries: ["US", "CA", "GB", "IE"],

  async fetch({ limit, query, log }: FetchContext): Promise<RawJob[]> {
    const out: RawJob[] = [];

    for (let page = 0; page < PAGES; page++) {
      const params = new URLSearchParams({ page: String(page) });
      if (query?.location) params.set("location", query.location);

      let body: { results?: MuseJob[] };
      try {
        body = await getJson(`https://www.themuse.com/api/public/jobs?${params}`);
      } catch (err) {
        // An unknown location is a 4xx here rather than an empty page, and
        // that should not fail the whole search.
        log(`themuse p${page}: ${String(err)}`);
        break;
      }

      const results = body.results ?? [];
      for (const job of results) {
        out.push({
          source: "themuse",
          sourceJobId: String(job.id),
          url: job.refs?.landing_page ?? "",
          title: job.name,
          companyName: job.company?.name ?? "Unknown",
          locationsRaw: (job.locations ?? []).map((l) => l.name),
          descriptionText: htmlToText(job.contents),
          employmentTypeRaw: job.type,
          departmentRaw: job.categories?.[0]?.name,
          tags: job.levels?.map((l) => l.name),
          postedAt: job.publication_date ? new Date(job.publication_date) : undefined,
        });
        if (limit && out.length >= limit) return out;
      }
      if (results.length === 0) break;
    }

    return out;
  },
};
