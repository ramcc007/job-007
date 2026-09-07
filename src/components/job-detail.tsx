import Link from "next/link";

import { Badge, EmploymentBadge, SeniorityBadge, WorkModeBadge } from "@/components/badges";
import { countryName, formatSalary, relativeDate } from "@/lib/format";
import { FUNCTION_LABELS, SOURCE_LABELS, VERTICAL_LABELS, labelFor } from "@/lib/search/labels";
import type { getJobBySlug } from "@/lib/search/query";

type JobDetailData = NonNullable<Awaited<ReturnType<typeof getJobBySlug>>>;

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  if (!children) return null;
  return (
    <div className="border-b border-line-soft py-2.5 last:border-0">
      <dt className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.12em] text-fg-faint">
        {label}
      </dt>
      <dd className="mt-1 text-[13px] text-fg">{children}</dd>
    </div>
  );
}

export function JobDetail({ job, standalone = false }: { job: JobDetailData; standalone?: boolean }) {
  const salary = formatSalary(job);
  const applyHref = job.applyUrl ?? job.externalUrl;

  const places = job.locations
    .map((l) =>
      [l.city, l.region, l.country ? countryName(l.countryCode ?? l.country) : null]
        .filter(Boolean)
        .join(", ") || (l.isRemote ? "Remote" : l.raw),
    )
    .filter(Boolean);

  return (
    <article className="flex h-full flex-col">
      <header className="border-b border-line px-5 py-4">
        {!job.isActive ? (
          <p className="mb-3 rounded border border-warn/40 bg-warn/10 px-2.5 py-1.5 text-[12px] text-warn">
            This listing is no longer appearing on the employer&rsquo;s careers page and may be filled.
          </p>
        ) : null}

        <h1 className={`font-[family-name:var(--font-display)] font-semibold leading-tight text-fg ${standalone ? "text-2xl" : "text-xl"}`}>
          {job.title}
        </h1>

        <p className="mt-1.5 text-sm text-fg-muted">
          <Link href={`/companies/${job.companySlug}`} className="text-fg hover:text-accent">
            {job.companyName}
          </Link>
          {job.locationLabel ? <span className="text-fg-faint"> · {job.locationLabel}</span> : null}
          <span className="text-fg-faint"> · {relativeDate(job.postedAt)}</span>
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <WorkModeBadge mode={job.workMode} />
          <SeniorityBadge seniority={job.seniority} />
          <EmploymentBadge type={job.employmentType} />
          {job.jobFunction ? <Badge>{labelFor(FUNCTION_LABELS, job.jobFunction)}</Badge> : null}
          {salary ? <Badge tone="teal">{salary}</Badge> : null}
        </div>

        <div className="mt-4 flex items-center gap-2">
          <a
            href={applyHref}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="inline-flex items-center gap-1.5 rounded-md bg-accent px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-accent-hover"
          >
            Apply on company site
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M7 17L17 7M17 7H8M17 7v9" />
            </svg>
          </a>
          {!standalone ? (
            <Link
              href={`/jobs/${job.slug}`}
              className="rounded-md border border-line px-3 py-2 text-sm text-fg-muted transition-colors hover:border-accent hover:text-accent"
            >
              Full page
            </Link>
          ) : null}
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        {job.descriptionExcerpt ? (
          <>
            <h2 className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.12em] text-fg-faint">
              Summary
            </h2>
            <p className="mt-2 text-[13.5px] leading-relaxed text-fg-muted">{job.descriptionExcerpt}</p>
          </>
        ) : null}

        {/*
          Only a short excerpt is shown. The full description is the
          employer's copyrighted text, so it stays on their site and we
          send the reader there rather than republishing it.
        */}
        <p className="mt-3 text-[12px] leading-relaxed text-fg-faint">
          This is a summary. Read the full description and apply on{" "}
          <a href={applyHref} target="_blank" rel="noopener noreferrer nofollow" className="text-accent hover:underline">
            {job.companyName}&rsquo;s own posting
          </a>
          .
        </p>

        <dl className="mt-5">
          <Fact label="Location">{places.length ? places.join(" · ") : null}</Fact>
          <Fact label="Industry">{job.vertical ? labelFor(VERTICAL_LABELS, job.vertical) : null}</Fact>
          <Fact label="Compensation">{salary ? `${salary} (as published by the employer)` : null}</Fact>
          <Fact label="Posted">{new Date(job.postedAt).toISOString().slice(0, 10)}</Fact>
          <Fact label="Found via">{labelFor(SOURCE_LABELS, job.source)}</Fact>
        </dl>
      </div>
    </article>
  );
}
