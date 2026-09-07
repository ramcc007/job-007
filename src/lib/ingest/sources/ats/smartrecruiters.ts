import { getJson, mapPool } from "@/lib/ingest/http";
import type { FetchContext, RawJob, SourceAdapter } from "@/lib/ingest/types";

/**
 * SmartRecruiters posting API — public, no key.
 *   GET https://api.smartrecruiters.com/v1/companies/{slug}/postings?limit=100&offset=N
 *
 * The list endpoint carries no description; fetching one detail request per
 * posting would multiply traffic by 100x, so classification here leans on
 * title, department and function instead. That is a deliberate trade: this
 * source contributes breadth, and the excerpt is left empty rather than
 * hammering the API.
 */
interface SrPosting {
  id: string;
  name: string;
  ref?: string;
  releasedDate?: string;
  company?: { identifier?: string; name?: string };
  location?: { city?: string; region?: string; country?: string; remote?: boolean };
  department?: { label?: string };
  function?: { label?: string };
  industry?: { label?: string };
  typeOfEmployment?: { label?: string };
  experienceLevel?: { label?: string };
}

const PAGE_SIZE = 100;
const MAX_PAGES = 10;

export const smartrecruiters: SourceAdapter = {
  name: "smartrecruiters",
  kind: "ats",

  async fetch({ seeds, limit, log }: FetchContext): Promise<RawJob[]> {
    const out: RawJob[] = [];

    const results = await mapPool(seeds, 3, async (seed) => {
      const postings: SrPosting[] = [];

      for (let page = 0; page < MAX_PAGES; page++) {
        const url =
          `https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(seed.slug)}/postings` +
          `?limit=${PAGE_SIZE}&offset=${page * PAGE_SIZE}`;
        const body = await getJson<{ content?: SrPosting[]; totalFound?: number }>(url);
        const batch = body.content ?? [];
        postings.push(...batch);
        if (batch.length < PAGE_SIZE) break;
      }

      return { seed, postings };
    });

    for (const result of results) {
      if (result.status === "rejected") {
        log(`smartrecruiters: ${String(result.reason)}`);
        continue;
      }
      const { seed, postings } = result.value;

      for (const posting of postings) {
        const location = [posting.location?.city, posting.location?.region, posting.location?.country]
          .filter((v) => v && v.trim())
          .join(", ");

        out.push({
          source: "smartrecruiters",
          sourceJobId: posting.id,
          url: `https://jobs.smartrecruiters.com/${encodeURIComponent(seed.slug)}/${posting.id}`,
          title: posting.name,
          companyName: seed.name ?? posting.company?.name ?? seed.slug,
          atsPlatform: "smartrecruiters",
          atsSlug: seed.slug,
          locationsRaw: location ? [location] : [],
          isRemoteHint: posting.location?.remote,
          employmentTypeRaw: posting.typeOfEmployment?.label,
          departmentRaw: posting.department?.label ?? posting.function?.label,
          // Seniority and industry labels feed the classifier as tags.
          tags: [posting.experienceLevel?.label, posting.industry?.label].filter(
            (v): v is string => Boolean(v),
          ),
          postedAt: posting.releasedDate ? new Date(posting.releasedDate) : undefined,
        });

        if (limit && out.length >= limit) return out;
      }
    }

    return out;
  },
};
