import { FUNCTIONS, SENIORITY, VERTICALS } from "@/lib/ingest/classify/taxonomy";

const toMap = (rows: { id: string; label: string }[]) =>
  new Map(rows.map((r) => [r.id, r.label]));

export const FUNCTION_LABELS = toMap(FUNCTIONS);
export const VERTICAL_LABELS = toMap(VERTICALS);
export const SENIORITY_LABELS = toMap(SENIORITY);

export const WORK_MODE_LABELS = new Map([
  ["remote", "Remote"],
  ["hybrid", "Hybrid"],
  ["onsite", "On-site"],
  ["unspecified", "Not stated"],
]);

export const EMPLOYMENT_LABELS = new Map([
  ["full_time", "Full-time"],
  ["part_time", "Part-time"],
  ["contract", "Contract"],
  ["internship", "Internship"],
  ["temporary", "Temporary"],
]);

export const SOURCE_LABELS = new Map([
  ["greenhouse", "Greenhouse"],
  ["lever", "Lever"],
  ["ashby", "Ashby"],
  ["workable", "Workable"],
  ["smartrecruiters", "SmartRecruiters"],
  ["recruitee", "Recruitee"],
  ["remotive", "Remotive"],
  ["remoteok", "RemoteOK"],
  ["arbeitnow", "Arbeitnow"],
  ["adzuna", "Adzuna"],
]);

export function labelFor(map: Map<string, string>, id: string | null | undefined): string {
  if (!id) return "Other";
  return map.get(id) ?? id.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
