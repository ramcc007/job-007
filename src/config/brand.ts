/**
 * Single source of truth for branding. Renaming the product means editing
 * this file and nothing else — copy, metadata, logo text and the palette
 * all read from here.
 */
export const brand = {
  name: "JobRail",
  tagline: "Every open role, straight from the source.",
  description:
    "Search jobs pulled directly from company career pages and open job " +
    "feeds worldwide — across every industry, function and seniority. " +
    "No reposts, no dead links, free to use.",
  domain: "jobrail.com",
  /** Identifies our crawler honestly to every source we fetch from. */
  userAgent: "JobRailBot/0.1 (+https://jobrail.com/bot)",
} as const;

export type Brand = typeof brand;
