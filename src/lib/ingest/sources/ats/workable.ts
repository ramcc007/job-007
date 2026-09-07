import { getJson, mapPool } from "@/lib/ingest/http";
import { htmlToText } from "@/lib/ingest/html";
import type { FetchContext, RawJob, SourceAdapter } from "@/lib/ingest/types";

/**
 * Workable's public careers widget — no key.
 *   GET https://apply.workable.com/api/v1/widget/accounts/{slug}?details=true
 *
 * The description arrives split across description/requirements/benefits,
 * so they are concatenated before classification.
 */
interface WorkableJob {
  title: string;
  shortcode: string;
  code?: string;
  employment_type?: string;
  telecommuting?: boolean;
  department?: string;
  url?: string;
  application_url?: string;
  published_on?: string;
  created_at?: string;
  country?: string;
  city?: string;
  state?: string;
  description?: string;
  requirements?: string;
  benefits?: string;
}

export const workable: SourceAdapter = {
  name: "workable",
  kind: "ats",

  async fetch({ seeds, limit, log }: FetchContext): Promise<RawJob[]> {
    const out: RawJob[] = [];

    const results = await mapPool(seeds, 4, async (seed) => {
      const url = `https://apply.workable.com/api/v1/widget/accounts/${encodeURIComponent(seed.slug)}?details=true`;
      const body = await getJson<{ name?: string; jobs?: WorkableJob[] }>(url);
      return { seed, name: body.name, jobs: body.jobs ?? [] };
    });

    for (const result of results) {
      if (result.status === "rejected") {
        log(`workable: ${String(result.reason)}`);
        continue;
      }
      const { seed, name, jobs } = result.value;

      for (const job of jobs) {
        const location = [job.city, job.state, job.country]
          .filter((v) => v && v.trim())
          .join(", ");

        const description = htmlToText(
          [job.description, job.requirements, job.benefits].filter(Boolean).join("\n\n"),
        );

        out.push({
          source: "workable",
          sourceJobId: job.shortcode,
          url: job.url ?? job.application_url ?? "",
          applyUrl: job.application_url,
          title: job.title,
          companyName: seed.name ?? name ?? seed.slug,
          atsPlatform: "workable",
          atsSlug: seed.slug,
          locationsRaw: location ? [location] : [],
          isRemoteHint: job.telecommuting,
          descriptionText: description,
          employmentTypeRaw: job.employment_type,
          departmentRaw: job.department,
          postedAt: parseDate(job.published_on ?? job.created_at),
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
