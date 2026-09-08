import { brand } from "@/config/brand";
import { htmlToText } from "@/lib/ingest/html";
import type { FetchContext, RawJob, SourceAdapter } from "@/lib/ingest/types";

/**
 * Jooble — an aggregator spanning 60+ countries including India, which
 * indexes national boards rather than requiring us to scrape them.
 *
 * The only source here that takes POST rather than GET, so it does not use
 * the shared getJson helper. A free key is issued on request at
 * jooble.org/api/about.
 */
interface JoobleJob {
  id?: number | string;
  title: string;
  location?: string;
  snippet?: string;
  salary?: string;
  source?: string;
  type?: string;
  link: string;
  company?: string;
  updated?: string;
}

/** Jooble is region-scoped by host; these are the markets worth routing to. */
const HOST_BY_COUNTRY: Record<string, string> = {
  IN: "in.jooble.org", US: "jooble.org", GB: "uk.jooble.org", CA: "ca.jooble.org",
  AU: "au.jooble.org", NZ: "nz.jooble.org", SG: "sg.jooble.org", AE: "ae.jooble.org",
  DE: "de.jooble.org", FR: "fr.jooble.org", ES: "es.jooble.org", IT: "it.jooble.org",
  NL: "nl.jooble.org", PL: "pl.jooble.org", BR: "br.jooble.org", MX: "mx.jooble.org",
  ZA: "za.jooble.org", PH: "ph.jooble.org", ID: "id.jooble.org", MY: "my.jooble.org",
  JP: "jp.jooble.org", IE: "ie.jooble.org", CH: "ch.jooble.org", AT: "at.jooble.org",
  BE: "be.jooble.org", SE: "se.jooble.org", PT: "pt.jooble.org", RO: "ro.jooble.org",
  TR: "tr.jooble.org", PK: "pk.jooble.org", BD: "bd.jooble.org", LK: "lk.jooble.org",
};

export const jooble: SourceAdapter = {
  name: "jooble",
  kind: "feed",
  countries: Object.keys(HOST_BY_COUNTRY),

  unavailableReason() {
    return process.env.JOOBLE_KEY
      ? null
      : "JOOBLE_KEY not set — free key at jooble.org/api/about, covers 60+ countries";
  },

  async fetch({ limit, query, log }: FetchContext): Promise<RawJob[]> {
    const key = process.env.JOOBLE_KEY!;
    const host = (query?.country && HOST_BY_COUNTRY[query.country]) ?? "jooble.org";

    let body: { jobs?: JoobleJob[] };
    try {
      const response = await fetch(`https://${host}/api/${encodeURIComponent(key)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "User-Agent": brand.userAgent },
        body: JSON.stringify({
          keywords: query?.text ?? "",
          location: query?.location ?? "",
          page: "1",
        }),
        signal: AbortSignal.timeout(20_000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      body = (await response.json()) as { jobs?: JoobleJob[] };
    } catch (err) {
      log(`jooble: ${String(err)}`);
      return [];
    }

    const jobs = (body.jobs ?? []).slice(0, limit ?? 200);

    return jobs.map((job, index) => ({
      source: "jooble",
      sourceJobId: String(job.id ?? `${host}:${index}:${job.link}`),
      url: job.link,
      title: job.title,
      companyName: job.company?.trim() || "Unknown",
      locationsRaw: job.location ? [job.location] : [],
      descriptionText: htmlToText(job.snippet),
      employmentTypeRaw: job.type,
      salaryRaw: job.salary,
      // Jooble names the board each listing came from; keep the credit.
      tags: job.source ? [job.source] : undefined,
      postedAt: job.updated ? new Date(job.updated) : undefined,
    }));
  },
};
