/**
 * Command-line entry point for a crawl.
 *
 *   npm run ingest                      every source
 *   npm run ingest -- --only lever      one source
 *   npm run ingest -- --limit 50        cap listings per source
 *   npm run ingest -- --dry-run         fetch and map, write nothing
 *   npm run ingest -- --fixtures        read recorded payloads, not the network
 */
import { loadSeeds } from "./seeds";
import { runIngest } from "./runner";
import { closeDb } from "@/lib/db";

function flag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function option(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main() {
  if (flag("fixtures")) {
    process.env.JOBRAIL_FIXTURES_DIR ??= "fixtures";
    console.log("using recorded fixtures instead of the network\n");
  }

  const only = option("only")?.split(",").map((s) => s.trim()).filter(Boolean);
  const limitRaw = option("limit");
  const limit = limitRaw ? Number(limitRaw) : undefined;
  if (limitRaw && !Number.isFinite(limit)) throw new Error(`--limit must be a number, got ${limitRaw}`);

  const seeds = await loadSeeds();
  console.log(`${seeds.length} company boards seeded\n`);

  const summary = await runIngest({
    only,
    seeds,
    limit,
    dryRun: flag("dry-run"),
    log: (msg) => console.log(msg),
  });

  console.log(`\n${"source".padEnd(16)}${"status".padEnd(9)}${"fetched".padStart(8)}${"kept".padStart(7)}${"new".padStart(7)}${"upd".padStart(7)}${"gone".padStart(7)}`);
  console.log("-".repeat(61));
  for (const r of summary.reports) {
    console.log(
      r.source.padEnd(16) + r.status.padEnd(9) +
      String(r.fetched).padStart(8) + String(r.accepted).padStart(7) +
      String(r.inserted).padStart(7) + String(r.updated).padStart(7) +
      String(r.deactivated).padStart(7),
    );
    if (r.message) console.log(`${"".padEnd(16)}↳ ${r.message}`);
  }

  const totals = summary.reports.reduce(
    (acc, r) => ({ kept: acc.kept + r.accepted, added: acc.added + r.inserted }),
    { kept: 0, added: 0 },
  );
  console.log(`\n${totals.kept} listings kept, ${totals.added} new, in ${(summary.durationMs / 1000).toFixed(1)}s`);

  await closeDb();
}

main().catch(async (err) => {
  console.error(err);
  await closeDb().catch(() => {});
  process.exit(1);
});
