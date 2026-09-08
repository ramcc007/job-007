import { dedupHash } from "@/lib/ingest/dedupe";
import { normalizeJob, type NormalizedJob } from "@/lib/ingest/normalize";
import { ADAPTERS } from "@/lib/ingest/sources";
import type { CompanySeed, SourceAdapter, SourceQuery } from "@/lib/ingest/types";
import { matchJob } from "./match";

/**
 * On-demand search. Nothing is stored: every search fans out across the
 * sources, filters what comes back, and streams matches as they arrive.
 *
 * The cost of that freshness is latency — a search takes tens of seconds
 * rather than milliseconds — so progress is reported per source and results
 * appear incrementally instead of after one long silence.
 */

export interface LiveJob {
  id: string;
  title: string;
  company: string;
  url: string;
  applyUrl: string | null;
  location: string;
  isRemote: boolean;
  workMode: string;
  seniority: string;
  employmentType: string;
  jobFunction: string | null;
  salary: { min: number | null; max: number | null; currency: string | null; period: string | null };
  postedAt: string;
  source: string;
  excerpt: string | null;
  score: number;
}

export type SearchEvent =
  | { type: "start"; sources: string[]; boards: number }
  | { type: "source"; name: string; status: "searching" | "done" | "error" | "skipped";
      scanned?: number; matched?: number; message?: string }
  | { type: "results"; jobs: LiveJob[] }
  | { type: "done"; total: number; scanned: number; elapsedMs: number }
  | { type: "error"; message: string };

function toLiveJob(job: NormalizedJob, score: number): LiveJob {
  const primary = job.locations[0];
  const place =
    job.locations
      .map((l) => l.city ?? l.country ?? (l.isRemote ? "Remote" : l.raw))
      .filter(Boolean)
      .slice(0, 2)
      .join(" · ") || (job.workMode === "remote" ? "Remote" : "Not stated");

  return {
    id: `${job.source}:${job.sourceJobId}`,
    title: job.title,
    company: job.companyName,
    url: job.externalUrl,
    applyUrl: job.applyUrl,
    location: place,
    isRemote: Boolean(primary?.isRemote) || job.workMode === "remote",
    workMode: job.workMode,
    seniority: job.seniority,
    employmentType: job.employmentType,
    jobFunction: job.jobFunction,
    salary: {
      min: job.salaryMin, max: job.salaryMax,
      currency: job.salaryCurrency, period: job.salaryPeriod,
    },
    postedAt: job.postedAt.toISOString(),
    source: job.source,
    excerpt: job.descriptionExcerpt,
    score,
  };
}

/**
 * Ceiling on listings considered per source.
 *
 * Set high on purpose. The ATS adapters fetch every seeded board before this
 * applies, so a low cap does not save any network time — it just discards
 * boards that happen to sit late in the list. At 400 the India seeds, which
 * were appended after the existing companies, were being cut off entirely
 * and a Gurgaon search could never have matched them. The cap now exists
 * only to bound memory on a pathological feed.
 */
const PER_SOURCE_LIMIT = 5000;

export interface LiveSearchOptions {
  query: SourceQuery;
  seeds: CompanySeed[];
  /** Abandon any source still running after this. */
  budgetMs?: number;
  signal?: AbortSignal;
}

export async function* liveSearch(
  options: LiveSearchOptions,
): AsyncGenerator<SearchEvent> {
  const started = Date.now();
  const budgetMs = options.budgetMs ?? 45_000;
  const { query, seeds } = options;

  const usable = ADAPTERS.filter((adapter) => {
    if (adapter.unavailableReason?.()) return false;
    if (adapter.kind !== "ats") return true;
    return seeds.some((seed) => seed.platform === adapter.name);
  });

  yield {
    type: "start",
    sources: usable.map((a) => a.name),
    boards: seeds.length,
  };

  const seen = new Set<string>();
  let total = 0;
  let scanned = 0;

  // Sources run concurrently, but results are yielded in completion order so
  // the page fills as soon as anything lands.
  const pending = new Map<string, Promise<{ adapter: SourceAdapter; jobs: NormalizedJob[]; scanned: number; error?: string }>>();

  for (const adapter of usable) {
    pending.set(
      adapter.name,
      (async () => {
        const relevant = seeds.filter((s) => s.platform === adapter.name);
        try {
          const raw = await adapter.fetch({
            seeds: relevant,
            query,
            limit: PER_SOURCE_LIMIT,
            log: () => {},
          });
          const normalized: NormalizedJob[] = [];
          for (const item of raw) {
            const job = normalizeJob(item);
            if (job) normalized.push(job);
          }
          return { adapter, jobs: normalized, scanned: raw.length };
        } catch (err) {
          return {
            adapter, jobs: [], scanned: 0,
            error: err instanceof Error ? err.message : String(err),
          };
        }
      })(),
    );
  }

  for (const name of pending.keys()) {
    yield { type: "source", name, status: "searching" };
  }

  const deadline = new Promise<null>((resolve) =>
    setTimeout(() => resolve(null), budgetMs),
  );

  while (pending.size > 0) {
    if (options.signal?.aborted) break;

    const settled = await Promise.race([
      Promise.race([...pending.values()].map((p) => p.then((r) => r))),
      deadline,
    ]);

    if (settled === null) {
      for (const name of pending.keys()) {
        yield { type: "source", name, status: "error", message: "timed out" };
      }
      break;
    }

    pending.delete(settled.adapter.name);
    scanned += settled.scanned;

    if (settled.error) {
      yield { type: "source", name: settled.adapter.name, status: "error", message: settled.error };
      continue;
    }

    const batch: LiveJob[] = [];
    for (const job of settled.jobs) {
      const { matched, score } = matchJob(job, query);
      if (!matched) continue;

      // The same role syndicated to several sources collapses to one row.
      const key = dedupHash({
        companyName: job.companyName,
        titleNormalized: job.titleNormalized,
        city: job.locations[0]?.city,
        countryCode: job.locations[0]?.countryCode,
        isRemote: job.workMode === "remote",
      });
      if (seen.has(key)) continue;
      seen.add(key);
      batch.push(toLiveJob(job, score));
    }

    batch.sort((a, b) => b.score - a.score);
    total += batch.length;

    yield {
      type: "source",
      name: settled.adapter.name,
      status: "done",
      scanned: settled.scanned,
      matched: batch.length,
    };
    if (batch.length) yield { type: "results", jobs: batch };
  }

  yield { type: "done", total, scanned, elapsedMs: Date.now() - started };
}
