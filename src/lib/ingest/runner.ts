import { eq, sql } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { sources as sourcesTable } from "@/lib/db/schema";
import { normalizeJob, type NormalizedJob } from "./normalize";
import { CompanyResolver, deactivateMissing, expireStale, upsertJobs } from "./persist";
import { ADAPTERS, ADAPTERS_BY_NAME } from "./sources";
import type { CompanySeed, SourceAdapter } from "./types";

export interface SourceReport {
  source: string;
  status: "ok" | "error" | "skipped";
  fetched: number;
  accepted: number;
  rejected: number;
  inserted: number;
  updated: number;
  deactivated: number;
  durationMs: number;
  message?: string;
  notes: string[];
}

export interface RunOptions {
  /** Restrict the run to these source names. */
  only?: string[];
  seeds?: CompanySeed[];
  limit?: number;
  /** Skip all writes — used by `ingest --dry-run` to inspect mapping. */
  dryRun?: boolean;
  log?: (msg: string) => void;
}

async function runSource(
  adapter: SourceAdapter,
  options: RunOptions,
  resolver: CompanyResolver,
  now: Date,
): Promise<SourceReport> {
  const started = Date.now();
  const notes: string[] = [];
  const log = options.log ?? (() => {});
  const note = (msg: string) => {
    notes.push(msg);
    log(`  ${msg}`);
  };

  const base: SourceReport = {
    source: adapter.name,
    status: "ok",
    fetched: 0, accepted: 0, rejected: 0, inserted: 0, updated: 0, deactivated: 0,
    durationMs: 0, notes,
  };

  const unavailable = adapter.unavailableReason?.();
  if (unavailable) {
    return { ...base, status: "skipped", message: unavailable, durationMs: Date.now() - started };
  }

  const seeds = (options.seeds ?? []).filter((s) => s.platform === adapter.name);
  if (adapter.kind === "ats" && seeds.length === 0) {
    return {
      ...base,
      status: "skipped",
      message: "no companies seeded for this platform in data/companies.yml",
      durationMs: Date.now() - started,
    };
  }

  let raw;
  try {
    raw = await adapter.fetch({ seeds, limit: options.limit, log: note });
  } catch (err) {
    return {
      ...base,
      status: "error",
      message: err instanceof Error ? err.message : String(err),
      durationMs: Date.now() - started,
    };
  }

  const normalized: NormalizedJob[] = [];
  for (const item of raw) {
    const job = normalizeJob(item, now);
    if (job) normalized.push(job);
  }

  base.fetched = raw.length;
  base.accepted = normalized.length;
  base.rejected = raw.length - normalized.length;

  if (options.dryRun) {
    return { ...base, durationMs: Date.now() - started };
  }

  const { inserted, updated, seenIds } = await upsertJobs(normalized, resolver, now);
  const deactivated = await deactivateMissing(adapter.name, seenIds, now);

  return { ...base, inserted, updated, deactivated, durationMs: Date.now() - started };
}

async function recordSourceRun(report: SourceReport, now: Date): Promise<void> {
  const db = await getDb();
  await db
    .insert(sourcesTable)
    .values({
      name: report.source,
      kind: ADAPTERS_BY_NAME.get(report.source)?.kind ?? "feed",
      lastRunAt: now,
      lastStatus: report.status,
      lastError: report.message ?? null,
      lastFetched: report.fetched,
      lastAccepted: report.accepted,
    })
    .onConflictDoUpdate({
      target: sourcesTable.name,
      set: {
        lastRunAt: sql`excluded.last_run_at`,
        lastStatus: sql`excluded.last_status`,
        lastError: sql`excluded.last_error`,
        lastFetched: sql`excluded.last_fetched`,
        lastAccepted: sql`excluded.last_accepted`,
      },
    });
}

export interface RunSummary {
  startedAt: Date;
  durationMs: number;
  reports: SourceReport[];
  expired: number;
}

/**
 * Runs every enabled source in turn.
 *
 * Sources are isolated from each other on purpose: one board changing its
 * response shape, or going down, must never stop the other nine from
 * updating the site.
 */
export async function runIngest(options: RunOptions = {}): Promise<RunSummary> {
  const now = new Date();
  const started = Date.now();
  const log = options.log ?? (() => {});
  const resolver = new CompanyResolver();

  const selected = options.only?.length
    ? ADAPTERS.filter((a) => options.only!.includes(a.name))
    : ADAPTERS;

  if (options.only?.length) {
    const unknown = options.only.filter((name) => !ADAPTERS_BY_NAME.has(name));
    if (unknown.length) throw new Error(`unknown source(s): ${unknown.join(", ")}`);
  }

  const reports: SourceReport[] = [];
  for (const adapter of selected) {
    log(`→ ${adapter.name}`);
    const report = await runSource(adapter, options, resolver, now);
    reports.push(report);
    if (!options.dryRun) await recordSourceRun(report, now);

    const detail =
      report.status === "ok"
        ? `${report.fetched} fetched, ${report.accepted} kept, +${report.inserted} new, ~${report.updated} updated, -${report.deactivated} retired`
        : `${report.status}${report.message ? `: ${report.message}` : ""}`;
    log(`  ${detail} (${report.durationMs}ms)`);
  }

  const expired = options.dryRun ? 0 : await expireStale();
  if (expired) log(`retired ${expired} listings not seen in 45 days`);

  return { startedAt: now, durationMs: Date.now() - started, reports, expired };
}

export async function listSourceStatus() {
  const db = await getDb();
  return db.select().from(sourcesTable).orderBy(sourcesTable.name);
}

export { eq };
