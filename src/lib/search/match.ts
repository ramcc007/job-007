import type { NormalizedJob } from "@/lib/ingest/normalize";

/**
 * Relevance matching for on-demand search.
 *
 * Most sources cannot filter by keyword or place — a company's job board
 * only knows how to list everything it has open — so matching happens here,
 * over already-normalised listings.
 */

const STOP_WORDS = new Set(["a", "an", "the", "of", "in", "for", "and", "or", "at", "to", "with"]);

export function tokenize(input: string): string[] {
  return input
    .toLowerCase()
    .split(/[^a-z0-9+#.]+/)
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

/** Locations that mean "anywhere", which should satisfy any place query. */
const ANYWHERE = /\b(worldwide|anywhere|global|remote)\b/i;

export interface MatchResult {
  matched: boolean;
  score: number;
}

/**
 * Scores a listing against the query.
 *
 * Every keyword must appear somewhere, so "digital marketing manager" does
 * not return every manager. Where a word appears decides the ranking: the
 * title is worth far more than the description, because a description
 * mentioning "marketing" does not make a role a marketing role.
 */
export function matchJob(
  job: NormalizedJob,
  query: { text?: string; location?: string },
): MatchResult {
  let score = 0;

  const words = query.text ? tokenize(query.text) : [];
  if (words.length) {
    const title = job.title.toLowerCase();
    const body = `${title} ${(job.descriptionExcerpt ?? "").toLowerCase()} ${job.companyName.toLowerCase()}`;

    for (const word of words) {
      if (title.includes(word)) score += 10;
      else if (body.includes(word)) score += 2;
      else return { matched: false, score: 0 };
    }

    // A title that reads as the whole phrase beats one that merely contains
    // the words scattered across it.
    if (title.includes(query.text!.toLowerCase().trim())) score += 25;
  }

  if (query.location) {
    const place = query.location.toLowerCase().trim();
    const hit = job.locations.some((location) => {
      const haystack = [location.city, location.region, location.country, location.raw]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (haystack.includes(place)) return true;
      // A fully remote role is workable from the place being searched.
      return location.isRemote && ANYWHERE.test(location.raw ?? "Remote");
    });

    if (!hit) return { matched: false, score: 0 };
    score += 8;
  }

  // Fresher postings first among equals.
  const ageDays = (Date.now() - job.postedAt.getTime()) / 86_400_000;
  score += Math.max(0, 10 - ageDays / 3);

  return { matched: true, score };
}
