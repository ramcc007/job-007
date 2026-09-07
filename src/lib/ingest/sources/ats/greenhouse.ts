import { getJson, mapPool } from "@/lib/ingest/http";
import { htmlToText } from "@/lib/ingest/html";
import type { FetchContext, RawJob, SourceAdapter } from "@/lib/ingest/types";

/**
 * Greenhouse job board API — public, no key.
 *   GET https://boards-api.greenhouse.io/v1/boards/{slug}/jobs?content=true
 *
 * `content` comes back as entity-escaped HTML, which htmlToText unwraps.
 * If a board 404s, the company slug in data/companies.yml is wrong or the
 * employer moved off Greenhouse.
 */
interface GhJob {
  id: number;
  title: string;
  absolute_url: string;
  updated_at?: string;
  first_published?: string;
  content?: string;
  location?: { name?: string };
  offices?: { name?: string; location?: string }[];
  departments?: { name?: string }[];
  metadata?: { name?: string; value?: unknown }[];
}

export const greenhouse: SourceAdapter = {
  name: "greenhouse",
  kind: "ats",

  async fetch({ seeds, limit, log }: FetchContext): Promise<RawJob[]> {
    const out: RawJob[] = [];

    const results = await mapPool(seeds, 4, async (seed) => {
      const url = `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(seed.slug)}/jobs?content=true`;
      const body = await getJson<{ jobs?: GhJob[] }>(url);
      return { seed, jobs: body.jobs ?? [] };
    });

    for (const result of results) {
      if (result.status === "rejected") {
        log(`greenhouse: ${String(result.reason)}`);
        continue;
      }
      const { seed, jobs } = result.value;

      for (const job of jobs) {
        const locations = [
          job.location?.name,
          ...(job.offices ?? []).map((o) => o.location || o.name),
        ].filter((v): v is string => Boolean(v && v.trim()));

        out.push({
          source: "greenhouse",
          sourceJobId: String(job.id),
          url: job.absolute_url,
          title: job.title,
          companyName: seed.name ?? seed.slug,
          atsPlatform: "greenhouse",
          atsSlug: seed.slug,
          locationsRaw: [...new Set(locations)],
          descriptionText: htmlToText(job.content),
          departmentRaw: job.departments?.[0]?.name,
          postedAt: parseDate(job.first_published ?? job.updated_at),
        });

        if (limit && out.length >= limit) return out;
      }
    }

    return out;
  },
};

function parseDate(value?: string): Date | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
}
