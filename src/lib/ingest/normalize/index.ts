import { excerpt, repairEncoding } from "../html";
import { classify } from "../classify";
import { dedupHash } from "../dedupe";
import type { RawJob } from "../types";
import { inferEmploymentType, inferWorkMode, parseHybridDays, type EmploymentType, type WorkMode } from "./attributes";
import { parseLocations, type ParsedLocation } from "./location";
import { resolveSalary } from "./salary";
import { cleanTitle, normalizeTitle, slugify } from "./title";

export interface NormalizedJob {
  source: string;
  sourceJobId: string;
  externalUrl: string;
  applyUrl: string | null;
  slug: string;

  title: string;
  titleNormalized: string;
  descriptionExcerpt: string | null;

  companyName: string;
  companyWebsite: string | null;
  companyLogoUrl: string | null;
  atsPlatform: string | null;
  atsSlug: string | null;

  locations: ParsedLocation[];
  workMode: WorkMode;
  hybridOfficeDays: number | null;
  employmentType: EmploymentType;
  seniority: string;
  jobFunction: string | null;
  vertical: string | null;

  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
  salaryPeriod: string | null;

  postedAt: Date;
  tags: string[];
  dedupHash: string;
}

/**
 * Section headings that some feeds emit in the title field instead of the
 * actual role. A listing called "Job Summary" is unusable to a job seeker,
 * so it is dropped rather than published.
 */
const NON_TITLES = /^(job\s*(summary|description|title|posting)|description|summary|apply now|n\/?a|untitled|position|vacancy)$/i;

/** Postings dated in the future, or absurdly old, are treated as undated. */
const MAX_FUTURE_MS = 2 * 24 * 60 * 60 * 1000;
const MAX_AGE_MS = 3 * 365 * 24 * 60 * 60 * 1000;

function safePostedAt(value: Date | undefined, now: Date): Date {
  if (!value || Number.isNaN(value.getTime())) return now;
  const delta = value.getTime() - now.getTime();
  if (delta > MAX_FUTURE_MS) return now;
  if (now.getTime() - value.getTime() > MAX_AGE_MS) return now;
  return value;
}

/**
 * Turns one raw listing into the canonical shape the database stores.
 *
 * Returns null when the listing is unusable — no title, or no link to the
 * original posting. Dropping those is deliberate: a row nobody can apply
 * through is worse than no row.
 */
export function normalizeJob(raw: RawJob, now = new Date()): NormalizedJob | null {
  const title = cleanTitle(repairEncoding(raw.title ?? ""));
  if (!title || !raw.url || NON_TITLES.test(title)) return null;

  const titleNormalized = normalizeTitle(title);
  if (!titleNormalized) return null;

  const locations = parseLocations((raw.locationsRaw ?? []).map(repairEncoding), raw.isRemoteHint);
  const description = repairEncoding(raw.descriptionText ?? "");
  const workMode = inferWorkMode(`${title}\n${description}`, locations, raw.isRemoteHint);
  const salary = resolveSalary(raw);

  const { jobFunction, vertical, seniority } = classify({
    title,
    department: raw.departmentRaw,
    description,
    tags: raw.tags,
    companyName: raw.companyName,
  });

  const primary = locations[0];

  return {
    source: raw.source,
    sourceJobId: raw.sourceJobId,
    externalUrl: raw.url,
    applyUrl: raw.applyUrl ?? null,
    // Suffixed with source + id so two identically-titled roles at the same
    // company never collide on the URL.
    slug: `${slugify(`${raw.companyName}-${title}`)}-${slugify(raw.source)}-${slugify(raw.sourceJobId).slice(0, 12)}`,

    title,
    titleNormalized,
    descriptionExcerpt: description ? excerpt(description) : null,

    companyName: repairEncoding(raw.companyName ?? "").trim() || "Unknown",
    companyWebsite: raw.companyWebsite ?? null,
    companyLogoUrl: raw.companyLogoUrl ?? null,
    atsPlatform: raw.atsPlatform ?? null,
    atsSlug: raw.atsSlug ?? null,

    locations,
    workMode,
    hybridOfficeDays: workMode === "hybrid" ? parseHybridDays(description) : null,
    employmentType: inferEmploymentType(raw.employmentTypeRaw, title, description),
    seniority,
    jobFunction,
    vertical,

    salaryMin: salary.min,
    salaryMax: salary.max,
    salaryCurrency: salary.currency,
    salaryPeriod: salary.period,

    postedAt: safePostedAt(raw.postedAt, now),
    tags: [...new Set((raw.tags ?? []).map((t) => t.trim().toLowerCase()).filter(Boolean))].slice(0, 20),
    dedupHash: dedupHash({
      companyName: raw.companyName ?? "",
      titleNormalized,
      city: primary?.city,
      countryCode: primary?.countryCode,
      isRemote: workMode === "remote",
    }),
  };
}

export * from "./attributes";
export * from "./location";
export * from "./salary";
export * from "./title";
