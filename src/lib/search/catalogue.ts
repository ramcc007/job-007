import cities from "@/../data/cities.json";
import titles from "@/../data/job-titles.json";

export interface TitleEntry { title: string; function: string }
export interface CityEntry { city: string; country: string }

export const JOB_TITLES = titles as TitleEntry[];
export const CITIES = cities as CityEntry[];

const REGIONS = new Intl.DisplayNames(["en"], { type: "region" });

function countryName(code: string): string {
  try { return REGIONS.of(code) ?? code; } catch { return code; }
}

export interface Suggestion {
  value: string;
  label: string;
  hint?: string;
}

/**
 * Ranks catalogue entries against what has been typed.
 *
 * A prefix match beats a word-start match, which beats a match buried mid
 * string — so typing "man" offers "Manager" before "Product Manager" and
 * neither before "Human Resources". Shorter labels win ties, since they are
 * the more general search.
 */
function rank(label: string, needle: string): number {
  const haystack = label.toLowerCase();
  if (haystack === needle) return 1000;
  if (haystack.startsWith(needle)) return 500 - label.length;
  if (new RegExp(`\\b${needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`).test(haystack)) {
    return 250 - label.length;
  }
  return haystack.includes(needle) ? 100 - label.length : -1;
}

function search<T>(rows: T[], needle: string, label: (row: T) => string, limit: number): T[] {
  const scored: { row: T; score: number }[] = [];
  for (const row of rows) {
    const score = rank(label(row), needle);
    if (score >= 0) scored.push({ row, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.row);
}

export function suggestTitles(input: string, limit = 8): Suggestion[] {
  const needle = input.trim().toLowerCase();
  if (!needle) return [];
  return search(JOB_TITLES, needle, (t) => t.title, limit).map((t) => ({
    value: t.title,
    label: t.title,
    hint: t.function.replace(/_/g, " "),
  }));
}

export function suggestCities(input: string, limit = 8): Suggestion[] {
  const needle = input.trim().toLowerCase();
  if (!needle) return [];

  const matches = search(CITIES, needle, (c) => c.city, limit).map((c) => ({
    value: c.city,
    label: c.city,
    hint: countryName(c.country),
  }));

  // "Remote" is not a city but it is what a great many people type.
  if ("remote".startsWith(needle) || "worldwide".startsWith(needle)) {
    matches.unshift({ value: "Remote", label: "Remote", hint: "anywhere" });
  }
  return matches.slice(0, limit);
}
