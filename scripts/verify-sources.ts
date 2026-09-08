/**
 * Runs a real search against every source and reports what each returned.
 *
 * This is the early warning for the failure this project is most exposed
 * to: a job board changing its API, or a company slug going stale so its
 * board silently returns nothing. Without it those surface only as a
 * quietly emptier site.
 */
import { loadSeeds } from "@/lib/ingest/seeds";
import { liveSearch } from "@/lib/search/live";

const query = {
  text: process.argv[2] ?? "engineer",
  location: process.argv[3] || undefined,
};

const seeds = await loadSeeds();
console.log(`${seeds.length} company boards seeded`);
console.log(`searching for "${query.text}"${query.location ? ` in ${query.location}` : ""}\n`);

let failures = 0;

for await (const event of liveSearch({ query, seeds, budgetMs: 120_000 })) {
  if (event.type === "source" && event.status !== "searching") {
    const detail =
      event.status === "done"
        ? `${String(event.scanned ?? 0).padStart(5)} scanned, ${String(event.matched ?? 0).padStart(4)} matched`
        : (event.message ?? event.status);
    console.log(`${event.name.padEnd(16)} ${event.status.padEnd(8)} ${detail}`);
    if (event.status === "error") failures++;
  } else if (event.type === "done") {
    console.log(`\n${event.total} matches from ${event.scanned} listings in ${(event.elapsedMs / 1000).toFixed(1)}s`);
  }
}

if (failures > 0) {
  console.error(`\n${failures} source(s) errored`);
  process.exit(1);
}
