import { getJson } from "@/lib/ingest/http";
import { htmlToText } from "@/lib/ingest/html";
import type { FetchContext, RawJob, SourceAdapter } from "@/lib/ingest/types";

/**
 * Remotive public API — no key.
 *   GET https://remotive.com/api/remote-jobs?limit=N
 * Every listing here is remote by definition.
 */
interface RemotiveJob {
  id: number;
  url: string;
  title: string;
  company_name: string;
  company_logo?: string;
  category?: string;
  tags?: string[];
  job_type?: string;
  publication_date?: string;
  candidate_required_location?: string;
  salary?: string;
  description?: string;
}

export const remotive: SourceAdapter = {
  name: "remotive",
  kind: "feed",

  async fetch({ limit, query }: FetchContext): Promise<RawJob[]> {
    const params = new URLSearchParams({ limit: String(limit ?? 500) });
    if (query?.text) params.set("search", query.text);
    const url = `https://remotive.com/api/remote-jobs?${params}`;
    const body = await getJson<{ jobs?: RemotiveJob[] }>(url);

    return (body.jobs ?? []).map((job) => ({
      source: "remotive",
      sourceJobId: String(job.id),
      url: job.url,
      title: job.title,
      companyName: job.company_name,
      companyLogoUrl: job.company_logo,
      locationsRaw: job.candidate_required_location ? [job.candidate_required_location] : [],
      isRemoteHint: true,
      descriptionText: htmlToText(job.description),
      employmentTypeRaw: job.job_type,
      departmentRaw: job.category,
      salaryRaw: job.salary,
      tags: job.tags,
      postedAt: job.publication_date ? new Date(job.publication_date) : undefined,
    }));
  },
};
