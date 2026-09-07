import type { ParsedLocation } from "./location";

export type WorkMode = "remote" | "hybrid" | "onsite" | "unspecified";
export type EmploymentType =
  | "full_time" | "part_time" | "contract" | "internship" | "temporary";

const HYBRID = /\bhybrid\b|\b\d\s*days?\s*(?:a|per)\s*week\s*in\s*(?:the\s*)?office\b|\bin[-\s]?office\s+\d\s*days?\b/i;
const ONSITE = /\bon[-\s]?site\b|\bin[-\s]?person\b|\bwork from office\b|\bwfo\b|\bfully on[-\s]?site\b/i;
const REMOTE = /\b(fully\s+)?remote\b|\bwork from home\b|\bwfh\b|\bwork from anywhere\b|\bdistributed team\b/i;
const NOT_REMOTE = /\bno[t]?\s+(?:a\s+)?remote\b|\bremote\s+work\s+is\s+not\b|\bthis\s+is\s+not\s+a\s+remote\b/i;

/**
 * Decides work mode from the explicit source flag first, then the text.
 *
 * Hybrid is checked before remote because postings routinely say "remote"
 * and "hybrid" in the same breath ("remote-friendly hybrid role") and the
 * more restrictive reading is the accurate one. Anything undetermined stays
 * "unspecified" rather than being guessed at — a wrong badge is worse than
 * an absent one.
 */
export function inferWorkMode(
  text: string,
  locations: ParsedLocation[],
  remoteHint?: boolean,
): WorkMode {
  if (remoteHint === true) return "remote";
  if (locations.some((l) => l.isRemote) && !HYBRID.test(text)) return "remote";

  const haystack = text.slice(0, 4000);
  if (NOT_REMOTE.test(haystack)) return ONSITE.test(haystack) ? "onsite" : "unspecified";
  if (HYBRID.test(haystack)) return "hybrid";
  if (REMOTE.test(haystack)) return "remote";
  if (ONSITE.test(haystack)) return "onsite";
  return "unspecified";
}

/** In-office days for a hybrid role, when the posting states a number. */
export function parseHybridDays(text: string): number | null {
  const match =
    /\b(\d)\s*(?:\+)?\s*days?\s*(?:a|per)\s*week\s*(?:in|at)\s*(?:the\s*)?office\b/i.exec(text) ??
    /\bin[-\s]?(?:the\s*)?office\s*(\d)\s*days?\b/i.exec(text);
  if (!match) return null;
  const days = Number(match[1]);
  return days >= 1 && days <= 7 ? days : null;
}

const EMPLOYMENT_RULES: [RegExp, EmploymentType][] = [
  [/\bintern(ship)?\b|\btrainee\b|\bapprentice(ship)?\b|\bworking student\b/i, "internship"],
  [/\bpart[-\s]?time\b|\bpartTime\b/i, "part_time"],
  [/\bcontract(or)?\b|\bfreelance\b|\bb2b\b|\bconsultant\b|\bfixed[-\s]?term\b/i, "contract"],
  [/\btemp(orary)?\b|\bseasonal\b|\binterim\b/i, "temporary"],
  [/\bfull[-\s]?time\b|\bfullTime\b|\bpermanent\b|\bregular\b/i, "full_time"],
];

/**
 * Full-time is the default: it is by far the most common arrangement, and
 * most postings only state the type when it is something other than that.
 */
export function inferEmploymentType(raw: string | undefined, title: string, text: string): EmploymentType {
  for (const source of [raw ?? "", title]) {
    for (const [pattern, type] of EMPLOYMENT_RULES) {
      if (pattern.test(source)) return type;
    }
  }
  for (const [pattern, type] of EMPLOYMENT_RULES) {
    if (pattern.test(text.slice(0, 2000))) return type;
  }
  return "full_time";
}
