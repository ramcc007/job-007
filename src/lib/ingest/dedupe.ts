import { createHash } from "node:crypto";

/**
 * Stable key for "the same job, wherever we found it".
 *
 * Company plus normalised title plus the primary city is the tightest key
 * that still collapses genuine duplicates: the same role syndicated to
 * Greenhouse, RemoteOK and Adzuna arrives with three different ids and
 * three slightly different titles, but the same employer, role and place.
 *
 * City is included deliberately — "Support Engineer" in Berlin and in
 * Bengaluru are two different openings, not one posted twice.
 */
export function dedupHash(parts: {
  companyName: string;
  titleNormalized: string;
  city?: string | null;
  countryCode?: string | null;
  isRemote?: boolean;
}): string {
  const company = parts.companyName.toLowerCase().replace(/[^a-z0-9]+/g, "");
  const place = parts.isRemote
    ? "remote"
    : `${(parts.city ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "")}:${parts.countryCode ?? ""}`;

  return createHash("sha1")
    .update(`${company}|${parts.titleNormalized}|${place}`)
    .digest("hex")
    .slice(0, 32);
}
