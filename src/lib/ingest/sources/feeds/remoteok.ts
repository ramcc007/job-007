import { getJson } from "@/lib/ingest/http";
import { htmlToText } from "@/lib/ingest/html";
import type { FetchContext, RawJob, SourceAdapter } from "@/lib/ingest/types";

/**
 * RemoteOK public API — no key.
 *   GET https://remoteok.com/api
 *
 * The first array element is a legal/attribution notice rather than a job,
 * and is skipped. Their terms require a visible backlink to the original
 * posting, which every job card and detail page provides.
 */
interface RemoteOkRow {
  id?: string;
  slug?: string;
  legal?: string;
  epoch?: number;
  date?: string;
  company?: string;
  company_logo?: string;
  logo?: string;
  position?: string;
  tags?: string[];
  description?: string;
  location?: string;
  salary_min?: number;
  salary_max?: number;
  url?: string;
  apply_url?: string;
}

export const remoteok: SourceAdapter = {
  name: "remoteok",
  kind: "feed",

  async fetch({ limit }: FetchContext): Promise<RawJob[]> {
    const rows = await getJson<RemoteOkRow[]>("https://remoteok.com/api");
    const jobs = (Array.isArray(rows) ? rows : []).filter((r) => !r.legal && r.id && r.position);

    const sliced = limit ? jobs.slice(0, limit) : jobs;

    return sliced.map((job) => ({
      source: "remoteok",
      sourceJobId: String(job.id),
      url: job.url ?? `https://remoteok.com/remote-jobs/${job.slug ?? job.id}`,
      applyUrl: job.apply_url,
      title: job.position!,
      companyName: job.company ?? "Unknown",
      companyLogoUrl: job.company_logo ?? job.logo,
      // "Worldwide" and similar are the norm here; blank means unrestricted.
      locationsRaw: job.location ? [job.location] : [],
      isRemoteHint: true,
      descriptionText: htmlToText(job.description),
      salaryMin: job.salary_min,
      salaryMax: job.salary_max,
      salaryCurrency: job.salary_min ? "USD" : undefined,
      salaryPeriod: job.salary_min ? "year" : undefined,
      tags: job.tags,
      postedAt: job.epoch ? new Date(job.epoch * 1000) : job.date ? new Date(job.date) : undefined,
    }));
  },
};
