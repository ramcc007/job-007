import type { SearchParams } from "./query";

/** Query-string key for each search field, kept short for shareable URLs. */
export const PARAM_KEYS = {
  q: "q",
  location: "l",
  country: "country",
  workMode: "mode",
  jobFunction: "fn",
  vertical: "industry",
  seniority: "level",
  employmentType: "type",
  source: "src",
  company: "company",
  posted: "since",
  salaryMin: "pay",
  sort: "sort",
  page: "page",
} as const satisfies Record<Exclude<keyof SearchParams, "perPage">, string>;

type RawParams = Record<string, string | string[] | undefined>;

const first = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

const num = (value: string | undefined): number | undefined => {
  if (!value) return undefined;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : undefined;
};

export function parseSearchParams(raw: RawParams): SearchParams {
  const sort = first(raw[PARAM_KEYS.sort]);
  return {
    q: first(raw[PARAM_KEYS.q])?.slice(0, 200),
    location: first(raw[PARAM_KEYS.location])?.slice(0, 100),
    country: first(raw[PARAM_KEYS.country])?.slice(0, 2).toUpperCase(),
    workMode: first(raw[PARAM_KEYS.workMode]),
    jobFunction: first(raw[PARAM_KEYS.jobFunction]),
    vertical: first(raw[PARAM_KEYS.vertical]),
    seniority: first(raw[PARAM_KEYS.seniority]),
    employmentType: first(raw[PARAM_KEYS.employmentType]),
    source: first(raw[PARAM_KEYS.source]),
    company: first(raw[PARAM_KEYS.company]),
    posted: num(first(raw[PARAM_KEYS.posted])),
    salaryMin: num(first(raw[PARAM_KEYS.salaryMin])),
    sort: sort === "relevance" || sort === "salary" ? sort : "recent",
    page: num(first(raw[PARAM_KEYS.page])) ?? 1,
  };
}

/**
 * Builds a URL with one facet toggled. Selecting the value already active
 * clears it, so every filter chip doubles as its own "remove".
 */
export function toggleUrl(
  current: SearchParams,
  field: keyof SearchParams,
  value: string | number | undefined,
  extraPath = "/jobs",
): string {
  const next: SearchParams = { ...current, page: undefined };
  const isActive = String(current[field] ?? "") === String(value ?? "");
  (next as Record<string, unknown>)[field] = isActive ? undefined : value;

  const search = new URLSearchParams();
  for (const [field_, key] of Object.entries(PARAM_KEYS)) {
    const v = next[field_ as keyof SearchParams];
    if (v === undefined || v === null || v === "" ) continue;
    if (field_ === "sort" && v === "recent") continue;
    if (field_ === "page" && v === 1) continue;
    search.set(key, String(v));
  }

  const qs = search.toString();
  return qs ? `${extraPath}?${qs}` : extraPath;
}

export function pageUrl(current: SearchParams, page: number, path = "/jobs"): string {
  return toggleUrl({ ...current, page: undefined }, "page", page === 1 ? undefined : page, path);
}

export function hasAnyFilter(params: SearchParams): boolean {
  return Boolean(
    params.q || params.location || params.country || params.workMode || params.jobFunction ||
    params.vertical || params.seniority || params.employmentType || params.source ||
    params.company || params.posted || params.salaryMin,
  );
}
