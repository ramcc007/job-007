import Link from "next/link";

import { EmploymentBadge, SeniorityBadge, WorkModeBadge } from "@/components/badges";
import { formatSalary, relativeDate } from "@/lib/format";
import { FUNCTION_LABELS, SOURCE_LABELS, labelFor } from "@/lib/search/labels";
import type { JobResult } from "@/lib/search/query";

export function JobCard({
  job,
  href,
  selected = false,
}: {
  job: JobResult;
  href: string;
  selected?: boolean;
}) {
  const salary = formatSalary(job);

  return (
    <Link
      href={href}
      scroll={false}
      aria-current={selected ? "true" : undefined}
      className={`group relative block border-b border-line-soft px-4 py-3.5 transition-colors ${
        selected ? "bg-elevated" : "hover:bg-hover/60"
      }`}
    >
      {/* The rail: a lit edge marks the selected row. */}
      <span
        aria-hidden="true"
        className={`absolute left-0 top-0 h-full w-0.5 transition-colors ${selected ? "bg-accent" : "bg-transparent group-hover:bg-line"}`}
      />

      <div className="flex items-start justify-between gap-3">
        <h3 className="font-[family-name:var(--font-display)] text-[15px] font-medium leading-snug text-fg group-hover:text-accent">
          {job.title}
        </h3>
        <time
          dateTime={new Date(job.postedAt).toISOString()}
          className="shrink-0 pt-0.5 font-[family-name:var(--font-mono)] text-[11px] text-fg-faint"
        >
          {relativeDate(job.postedAt)}
        </time>
      </div>

      <p className="mt-1 truncate text-[13px] text-fg-muted">
        <span className="text-fg">{job.companyName}</span>
        {job.locationLabel ? <span className="text-fg-faint"> · {job.locationLabel}</span> : null}
      </p>

      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <WorkModeBadge mode={job.workMode} />
        <SeniorityBadge seniority={job.seniority} />
        <EmploymentBadge type={job.employmentType} />
        {job.jobFunction ? (
          <span className="text-[11px] text-fg-faint">{labelFor(FUNCTION_LABELS, job.jobFunction)}</span>
        ) : null}
        {salary ? (
          <span className="ml-auto font-[family-name:var(--font-mono)] text-[12px] text-teal">{salary}</span>
        ) : null}
      </div>

      {job.alsoOn.length > 0 ? (
        <p className="mt-2 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-wide text-fg-faint">
          also on {job.alsoOn.map((s) => labelFor(SOURCE_LABELS, s)).join(", ")}
        </p>
      ) : null}
    </Link>
  );
}
