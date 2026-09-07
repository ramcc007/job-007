import Link from "next/link";

import { countryName } from "@/lib/format";
import {
  EMPLOYMENT_LABELS, FUNCTION_LABELS, SENIORITY_LABELS, SOURCE_LABELS,
  VERTICAL_LABELS, WORK_MODE_LABELS, labelFor,
} from "@/lib/search/labels";
import { hasAnyFilter, toggleUrl } from "@/lib/search/params";
import type { FacetBucket, Facets, SearchParams } from "@/lib/search/query";

const POSTED_OPTIONS = [
  { value: 1, label: "Last 24 hours" },
  { value: 7, label: "Last 7 days" },
  { value: 14, label: "Last 14 days" },
  { value: 30, label: "Last 30 days" },
];

function FacetGroup({
  title,
  buckets,
  field,
  params,
  labels,
  limit = 8,
  renderLabel,
}: {
  title: string;
  buckets: FacetBucket[];
  field: keyof SearchParams;
  params: SearchParams;
  labels?: Map<string, string>;
  limit?: number;
  renderLabel?: (value: string) => string;
}) {
  if (buckets.length === 0) return null;

  const active = params[field];
  // Keep the selected value visible even if it falls outside the top N.
  const visible = buckets.slice(0, limit);
  const activeBucket = buckets.find((b) => String(b.value) === String(active));
  if (activeBucket && !visible.includes(activeBucket)) visible.push(activeBucket);
  const overflow = buckets.length - visible.length;

  return (
    <details open className="group border-b border-line-soft py-3">
      <summary className="flex cursor-pointer list-none items-center justify-between font-[family-name:var(--font-mono)] text-[10px] font-medium uppercase tracking-[0.12em] text-fg-faint hover:text-fg-muted">
        {title}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="transition-transform group-open:rotate-180" aria-hidden="true">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </summary>

      <ul className="mt-2 space-y-0.5">
        {visible.map((bucket) => {
          const isActive = String(active ?? "") === String(bucket.value);
          const text = renderLabel
            ? renderLabel(bucket.value)
            : labels
              ? labelFor(labels, bucket.value)
              : bucket.value;

          return (
            <li key={bucket.value}>
              <Link
                href={toggleUrl(params, field, bucket.value)}
                className={`flex items-baseline justify-between gap-2 rounded px-1.5 py-1 text-[13px] transition-colors ${
                  isActive ? "bg-accent-dim/30 text-accent" : "text-fg-muted hover:bg-hover hover:text-fg"
                }`}
              >
                <span className="truncate">{text}</span>
                <span className="shrink-0 font-[family-name:var(--font-mono)] text-[11px] text-fg-faint">
                  {bucket.count}
                </span>
              </Link>
            </li>
          );
        })}
        {overflow > 0 ? (
          <li className="px-1.5 pt-0.5 text-[11px] text-fg-faint">+{overflow} more</li>
        ) : null}
      </ul>
    </details>
  );
}

export function FacetRail({ facets, params }: { facets: Facets; params: SearchParams }) {
  return (
    <nav aria-label="Filter results" className="text-sm">
      <div className="flex items-center justify-between border-b border-line pb-2">
        <h2 className="font-[family-name:var(--font-display)] text-[13px] font-medium text-fg">Filters</h2>
        {hasAnyFilter(params) ? (
          <Link href="/jobs" className="text-[11px] text-accent hover:text-accent-hover">
            Clear all
          </Link>
        ) : null}
      </div>

      <details open className="border-b border-line-soft py-3">
        <summary className="cursor-pointer list-none font-[family-name:var(--font-mono)] text-[10px] font-medium uppercase tracking-[0.12em] text-fg-faint">
          Date posted
        </summary>
        <ul className="mt-2 space-y-0.5">
          {POSTED_OPTIONS.map((option) => {
            const isActive = params.posted === option.value;
            return (
              <li key={option.value}>
                <Link
                  href={toggleUrl(params, "posted", option.value)}
                  className={`block rounded px-1.5 py-1 text-[13px] transition-colors ${
                    isActive ? "bg-accent-dim/30 text-accent" : "text-fg-muted hover:bg-hover hover:text-fg"
                  }`}
                >
                  {option.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </details>

      <FacetGroup title="Work mode" buckets={facets.workMode} field="workMode" params={params} labels={WORK_MODE_LABELS} />
      <FacetGroup title="Function" buckets={facets.jobFunction} field="jobFunction" params={params} labels={FUNCTION_LABELS} limit={10} />
      <FacetGroup title="Industry" buckets={facets.vertical} field="vertical" params={params} labels={VERTICAL_LABELS} />
      <FacetGroup title="Seniority" buckets={facets.seniority} field="seniority" params={params} labels={SENIORITY_LABELS} />
      <FacetGroup title="Employment" buckets={facets.employmentType} field="employmentType" params={params} labels={EMPLOYMENT_LABELS} />
      <FacetGroup title="Country" buckets={facets.country} field="country" params={params} renderLabel={countryName} limit={10} />
      <FacetGroup title="Source" buckets={facets.source} field="source" params={params} labels={SOURCE_LABELS} limit={10} />
    </nav>
  );
}
