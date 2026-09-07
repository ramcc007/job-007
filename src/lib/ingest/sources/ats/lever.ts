import { getJson, mapPool } from "@/lib/ingest/http";
import type { FetchContext, RawJob, SourceAdapter } from "@/lib/ingest/types";

/**
 * Lever postings API — public, no key.
 *   GET https://api.lever.co/v0/postings/{slug}?mode=json
 *
 * Richer than most: it hands back a plain-text description, an explicit
 * workplaceType, and a structured salary range, so little inference is
 * needed downstream.
 */
interface LeverPost {
  id: string;
  text: string;
  hostedUrl: string;
  applyUrl?: string;
  createdAt?: number;
  descriptionPlain?: string;
  workplaceType?: string;
  country?: string;
  categories?: {
    commitment?: string;
    department?: string;
    location?: string;
    team?: string;
    allLocations?: string[];
  };
  salaryRange?: { min?: number; max?: number; currency?: string; interval?: string };
}

/** Lever writes intervals as "per-year-salary" / "per-hour-wage". */
function salaryPeriod(interval?: string): string | undefined {
  if (!interval) return undefined;
  const match = /per-(year|month|week|day|hour)/.exec(interval);
  return match?.[1];
}

export const lever: SourceAdapter = {
  name: "lever",
  kind: "ats",

  async fetch({ seeds, limit, log }: FetchContext): Promise<RawJob[]> {
    const out: RawJob[] = [];

    const results = await mapPool(seeds, 4, async (seed) => {
      const url = `https://api.lever.co/v0/postings/${encodeURIComponent(seed.slug)}?mode=json`;
      const posts = await getJson<LeverPost[]>(url);
      return { seed, posts: Array.isArray(posts) ? posts : [] };
    });

    for (const result of results) {
      if (result.status === "rejected") {
        log(`lever: ${String(result.reason)}`);
        continue;
      }
      const { seed, posts } = result.value;

      for (const post of posts) {
        const locations = [
          post.categories?.location,
          ...(post.categories?.allLocations ?? []),
        ].filter((v): v is string => Boolean(v && v.trim()));

        out.push({
          source: "lever",
          sourceJobId: post.id,
          url: post.hostedUrl,
          applyUrl: post.applyUrl,
          title: post.text,
          companyName: seed.name ?? seed.slug,
          atsPlatform: "lever",
          atsSlug: seed.slug,
          locationsRaw: [...new Set(locations)],
          isRemoteHint: post.workplaceType?.toLowerCase() === "remote",
          descriptionText: post.descriptionPlain,
          employmentTypeRaw: post.categories?.commitment,
          departmentRaw: post.categories?.department ?? post.categories?.team,
          salaryMin: post.salaryRange?.min,
          salaryMax: post.salaryRange?.max,
          salaryCurrency: post.salaryRange?.currency,
          salaryPeriod: salaryPeriod(post.salaryRange?.interval),
          postedAt: post.createdAt ? new Date(post.createdAt) : undefined,
        });

        if (limit && out.length >= limit) return out;
      }
    }

    return out;
  },
};
