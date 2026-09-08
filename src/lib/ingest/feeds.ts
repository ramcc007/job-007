import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { parse } from "yaml";

export interface FeedDefinition {
  name: string;
  url: string;
  /** Restrict to these ISO countries; omit for global. */
  countries?: string[];
  /** Every listing in this feed is remote. */
  remote?: boolean;
  /** Fixed employer, when the feed belongs to one company. */
  company?: string;
  /** Applied when an item carries no location of its own. */
  defaultLocation?: string;
}

/**
 * Reads data/feeds.yml. Adding a job board that publishes RSS is a few
 * lines there rather than a new adapter.
 */
export async function loadFeeds(
  path = join(process.cwd(), "data", "feeds.yml"),
): Promise<FeedDefinition[]> {
  let text: string;
  try {
    text = await readFile(path, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }

  const parsed = parse(text) as { feeds?: FeedDefinition[] } | null;
  return (parsed?.feeds ?? []).filter((feed) => feed?.url && feed?.name);
}
