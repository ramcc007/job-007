import { getJson } from "@/lib/ingest/http";
import { htmlToText } from "@/lib/ingest/html";
import type { FetchContext, RawJob, SourceAdapter } from "@/lib/ingest/types";

/**
 * Careerjet public search API — covers around 90 countries, India included,
 * and indexes national job boards under licence.
 *
 * Needs a free affiliate id from careerjet.com/partners/affiliate.
 */
interface CareerjetJob {
  title: string;
  company?: string;
  locations?: string;
  url: string;
  description?: string;
  date?: string;
  salary?: string;
}

/** Careerjet is scoped by locale rather than a country parameter. */
const LOCALE_BY_COUNTRY: Record<string, string> = {
  IN: "en_IN", US: "en_US", GB: "en_GB", CA: "en_CA", AU: "en_AU", NZ: "en_NZ",
  IE: "en_IE", SG: "en_SG", ZA: "en_ZA", AE: "en_AE", PH: "en_PH", MY: "en_MY",
  DE: "de_DE", AT: "de_AT", CH: "de_CH", FR: "fr_FR", BE: "fr_BE", ES: "es_ES",
  IT: "it_IT", NL: "nl_NL", PT: "pt_PT", PL: "pl_PL", SE: "sv_SE", DK: "da_DK",
  NO: "no_NO", FI: "fi_FI", BR: "pt_BR", MX: "es_MX", AR: "es_AR", JP: "ja_JP",
};

export const careerjet: SourceAdapter = {
  name: "careerjet",
  kind: "feed",
  countries: Object.keys(LOCALE_BY_COUNTRY),

  unavailableReason() {
    return process.env.CAREERJET_AFFID
      ? null
      : "CAREERJET_AFFID not set — free affiliate id at careerjet.com/partners/affiliate";
  },

  async fetch({ limit, query, log }: FetchContext): Promise<RawJob[]> {
    const params = new URLSearchParams({
      affid: process.env.CAREERJET_AFFID!,
      keywords: query?.text ?? "",
      location: query?.location ?? "",
      locale_code: (query?.country && LOCALE_BY_COUNTRY[query.country]) ?? "en_GB",
      pagesize: String(Math.min(limit ?? 99, 99)),
      // The API requires these for attribution; they identify the caller,
      // not an end user, so no visitor data is forwarded.
      user_ip: "0.0.0.0",
      user_agent: "JobRailBot",
      url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://job-007.vercel.app",
    });

    let body: { jobs?: CareerjetJob[]; type?: string };
    try {
      body = await getJson(`https://public.api.careerjet.net/search?${params}`);
    } catch (err) {
      log(`careerjet: ${String(err)}`);
      return [];
    }

    return (body.jobs ?? []).map((job, index) => ({
      source: "careerjet",
      sourceJobId: `${index}:${job.url}`,
      url: job.url,
      title: job.title,
      companyName: job.company?.trim() || "Unknown",
      locationsRaw: job.locations ? [job.locations] : [],
      descriptionText: htmlToText(job.description),
      salaryRaw: job.salary,
      postedAt: job.date ? new Date(job.date) : undefined,
    }));
  },
};
