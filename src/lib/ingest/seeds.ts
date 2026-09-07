import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { parse } from "yaml";

import { humanizeSlug } from "./normalize/title";
import type { CompanySeed } from "./types";

/**
 * Reads data/companies.yml into a flat seed list.
 *
 * The file is grouped by platform for human editing; the crawler wants one
 * flat list it can filter, so the shape is flipped here.
 */
export async function loadSeeds(path = join(process.cwd(), "data", "companies.yml")): Promise<CompanySeed[]> {
  let text: string;
  try {
    text = await readFile(path, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }

  const parsed = parse(text) as Record<string, unknown> | null;
  if (!parsed || typeof parsed !== "object") return [];

  const seeds: CompanySeed[] = [];
  for (const [platform, value] of Object.entries(parsed)) {
    if (!Array.isArray(value)) continue;
    for (const entry of value) {
      if (typeof entry === "string") {
        seeds.push({ platform, slug: entry, name: humanizeSlug(entry) });
      } else if (entry && typeof entry === "object" && "slug" in entry) {
        const row = entry as { slug: string; name?: string };
        seeds.push({ platform, slug: row.slug, name: row.name ?? humanizeSlug(row.slug) });
      }
    }
  }
  return seeds;
}
