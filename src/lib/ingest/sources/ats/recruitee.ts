import { getJson, mapPool } from "@/lib/ingest/http";
import { htmlToText } from "@/lib/ingest/html";
import type { FetchContext, RawJob, SourceAdapter } from "@/lib/ingest/types";

/**
 * Recruitee careers API — public, no key, one subdomain per employer.
 *   GET https://{slug}.recruitee.com/api/offers/
 */
interface RecruiteeOffer {
  id: number;
  title: string;
  slug?: string;
  careers_url?: string;
  careers_apply_url?: string;
  description?: string;
  requirements?: string;
  location?: string;
  city?: string;
  country_code?: string;
  department?: string;
  employment_type_code?: string;
  remote?: boolean;
  published_at?: string;
}

export const recruitee: SourceAdapter = {
  name: "recruitee",
  kind: "ats",

  async fetch({ seeds, limit, log }: FetchContext): Promise<RawJob[]> {
    const out: RawJob[] = [];

    const results = await mapPool(seeds, 4, async (seed) => {
      const url = `https://${encodeURIComponent(seed.slug)}.recruitee.com/api/offers/`;
      const body = await getJson<{ offers?: RecruiteeOffer[] }>(url);
      return { seed, offers: body.offers ?? [] };
    });

    for (const result of results) {
      if (result.status === "rejected") {
        log(`recruitee: ${String(result.reason)}`);
        continue;
      }
      const { seed, offers } = result.value;

      for (const offer of offers) {
        const location = offer.location ?? [offer.city, offer.country_code].filter(Boolean).join(", ");

        out.push({
          source: "recruitee",
          sourceJobId: String(offer.id),
          url: offer.careers_url ?? `https://${seed.slug}.recruitee.com/o/${offer.slug ?? offer.id}`,
          applyUrl: offer.careers_apply_url,
          title: offer.title,
          companyName: seed.name ?? seed.slug,
          atsPlatform: "recruitee",
          atsSlug: seed.slug,
          locationsRaw: location ? [location] : [],
          isRemoteHint: offer.remote,
          descriptionText: htmlToText(
            [offer.description, offer.requirements].filter(Boolean).join("\n\n"),
          ),
          employmentTypeRaw: offer.employment_type_code,
          departmentRaw: offer.department,
          postedAt: offer.published_at ? new Date(offer.published_at) : undefined,
        });

        if (limit && out.length >= limit) return out;
      }
    }

    return out;
  },
};
