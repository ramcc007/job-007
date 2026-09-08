import { getJson } from "@/lib/ingest/http";
import { htmlToText } from "@/lib/ingest/html";
import type { FetchContext, RawJob, SourceAdapter } from "@/lib/ingest/types";

/**
 * Adzuna search API — free tier, requires app_id + app_key from
 * https://developer.adzuna.com. This is the single biggest lever for
 * global coverage: one adapter, many countries.
 *
 *   GET https://api.adzuna.com/v1/api/jobs/{country}/search/{page}
 *       ?app_id=..&app_key=..&results_per_page=50
 *
 * Without credentials the adapter reports itself unavailable and the
 * runner skips it, rather than failing the whole crawl.
 */
interface AdzunaResult {
  id: string;
  created?: string;
  title?: string;
  description?: string;
  redirect_url?: string;
  salary_min?: number;
  salary_max?: number;
  salary_is_predicted?: string;
  contract_type?: string;
  contract_time?: string;
  location?: { area?: string[]; display_name?: string };
  company?: { display_name?: string };
  category?: { label?: string; tag?: string };
}

/** ISO country code -> the currency Adzuna quotes salaries in for it. */
const CURRENCY_BY_COUNTRY: Record<string, string> = {
  gb: "GBP", us: "USD", at: "EUR", au: "AUD", be: "EUR", br: "BRL",
  ca: "CAD", ch: "CHF", de: "EUR", es: "EUR", fr: "EUR", in: "INR",
  it: "EUR", mx: "MXN", nl: "EUR", nz: "NZD", pl: "PLN", sg: "SGD",
  za: "ZAR",
};

/** Every market Adzuna publishes, as ISO codes. */
const SUPPORTED = ["gb","us","at","au","be","br","ca","ch","de","es","fr","in","it","mx","nl","nz","pl","sg","za"];
const DEFAULT_COUNTRIES = ["gb", "us", "in", "de", "ca", "au", "nl", "fr", "sg"];
const PAGES_PER_COUNTRY = 3;
const PER_PAGE = 50;

export const adzuna: SourceAdapter = {
  name: "adzuna",
  kind: "feed",
  countries: SUPPORTED.map((c) => c.toUpperCase()),

  unavailableReason() {
    if (!process.env.ADZUNA_APP_ID || !process.env.ADZUNA_APP_KEY) {
      return "ADZUNA_APP_ID / ADZUNA_APP_KEY not set (free key at developer.adzuna.com)";
    }
    return null;
  },

  async fetch({ limit, log, query }: FetchContext): Promise<RawJob[]> {
    const appId = process.env.ADZUNA_APP_ID!;
    const appKey = process.env.ADZUNA_APP_KEY!;

    // Searching one market is both faster and far more relevant than
    // sweeping nine; only fall back to the spread when no country is known.
    const requested = query?.country?.toLowerCase();
    const countries =
      requested && SUPPORTED.includes(requested)
        ? [requested]
        : (process.env.ADZUNA_COUNTRIES ?? DEFAULT_COUNTRIES.join(","))
            .split(",")
            .map((c) => c.trim().toLowerCase())
            .filter((c) => SUPPORTED.includes(c));

    const out: RawJob[] = [];

    for (const country of countries) {
      for (let page = 1; page <= PAGES_PER_COUNTRY; page++) {
        // `what` and `where` are Adzuna's own keyword and place filters, so
        // an on-demand search is answered by Adzuna rather than by fetching
        // a sample and filtering it here.
        const params = new URLSearchParams({
          app_id: appId,
          app_key: appKey,
          results_per_page: String(PER_PAGE),
          "content-type": "application/json",
        });
        if (query?.text) params.set("what", query.text);
        if (query?.location) params.set("where", query.location);

        const url = `https://api.adzuna.com/v1/api/jobs/${country}/search/${page}?${params}`;

        let body: { results?: AdzunaResult[] };
        try {
          body = await getJson(url);
        } catch (err) {
          log(`adzuna ${country} p${page}: ${String(err)}`);
          // Failing on the very first page means the source contributed
          // nothing; surfacing that beats reporting a silent success.
          if (out.length === 0) throw err;
          break;
        }

        const results = body.results ?? [];
        for (const row of results) {
          // Predicted salaries are Adzuna's own estimate, not the
          // employer's figure — showing them as fact would be misleading.
          const predicted = row.salary_is_predicted === "1";

          out.push({
            source: "adzuna",
            sourceJobId: `${country}:${row.id}`,
            url: row.redirect_url ?? "",
            title: row.title ? htmlToText(row.title) : "",
            companyName: row.company?.display_name ?? "Unknown",
            locationsRaw: row.location?.display_name ? [row.location.display_name] : [],
            descriptionText: htmlToText(row.description),
            employmentTypeRaw: row.contract_time ?? row.contract_type,
            departmentRaw: row.category?.label,
            salaryMin: predicted ? undefined : row.salary_min,
            salaryMax: predicted ? undefined : row.salary_max,
            salaryCurrency: predicted ? undefined : CURRENCY_BY_COUNTRY[country],
            salaryPeriod: predicted ? undefined : "year",
            postedAt: row.created ? new Date(row.created) : undefined,
          });

          if (limit && out.length >= limit) return out;
        }

        if (results.length < PER_PAGE) break;
      }
    }

    return out;
  },
};
