/** Noise that job titles carry but that says nothing about the role. */
const NOISE_PATTERNS: RegExp[] = [
  /\((?:remote|hybrid|onsite|on-site|contract|full[-\s]?time|part[-\s]?time|m\/f\/d|m\/w\/d|w\/m\/d|d\/f\/m|h\/f|all genders?)\)/gi,
  /\b(?:m\/f\/d|m\/w\/d|w\/m\/d|d\/f\/m|f\/m\/x|m\/f\/x|h\/f)\b/gi,
  /\bjob\s*(?:id|req|requisition)?\s*[:#]\s*[a-z0-9-]+/gi,
  /\breq(?:uisition)?\s*[:#]?\s*\d{3,}/gi,
  /[-–—|,]\s*(?:remote|hybrid|onsite|on-site)\s*$/gi,
  /\bnew\s*!+\s*$/gi,
];

/**
 * Canonical form of a title, used for dedup keys and as a secondary
 * full-text field. Lower-cased, noise stripped, punctuation collapsed —
 * so "Senior Engineer (Remote) - Req #4471" and "Senior Engineer" match.
 */
export function normalizeTitle(title: string): string {
  let out = ` ${title} `;
  for (const pattern of NOISE_PATTERNS) out = out.replace(pattern, " ");
  out = dropModeSegments(out);
  return out
    .toLowerCase()
    .replace(/[^a-z0-9+#/&\s.-]/g, " ")
    .replace(/\s*[-–—/|]\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Display title with the same noise removed but original casing kept. */
export function cleanTitle(title: string): string {
  let out = ` ${title} `;
  for (const pattern of NOISE_PATTERNS) out = out.replace(pattern, " ");
  out = dropModeSegments(out);
  return out.replace(/\s+/g, " ").replace(/\s*[-–—|,]\s*$/, "").trim() || title.trim();
}

const MODE_ONLY = /^(?:fully\s+)?(?:remote|hybrid|onsite|on-site|wfh)$/i;

/**
 * Drops separator-delimited segments that say only where the work happens.
 * Work mode is a facet of its own, so leaving it in the title would make
 * "Engineer" and "Engineer - Remote" look like two different roles.
 */
function dropModeSegments(input: string): string {
  const segments = input.split(/\s*[-–—|]\s*/);
  if (segments.length < 2) return input;
  const kept = segments.filter((segment) => !MODE_ONLY.test(segment.trim()));
  return (kept.length ? kept : segments).join(" - ");
}

/** URL-safe slug, with a short suffix appended by the caller for uniqueness. */
export function slugify(input: string, maxLength = 70): string {
  const base = input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base.length > maxLength
    ? base.slice(0, maxLength).replace(/-+[^-]*$/, "").replace(/-+$/, "")
    : base;
}

/**
 * Turns a board slug into a display name ("netflix" -> "Netflix").
 *
 * Only used when data/companies.yml gives no explicit name. Employers with
 * stylised capitalisation (eBay, iRobot) should be given an explicit
 * `name:` there rather than relying on this.
 */
export function humanizeSlug(slug: string): string {
  return slug
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .map((word) => (word ? word[0]!.toUpperCase() + word.slice(1) : word))
    .join(" ") || slug;
}
