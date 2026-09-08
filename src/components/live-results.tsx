"use client";

import { useEffect, useRef, useState } from "react";

import { formatSalary, relativeDate } from "@/lib/format";
import { FUNCTION_LABELS, SENIORITY_LABELS, SOURCE_LABELS, labelFor } from "@/lib/search/labels";

interface LiveJob {
  id: string; title: string; company: string; url: string; applyUrl: string | null;
  location: string; isRemote: boolean; workMode: string; seniority: string;
  employmentType: string; jobFunction: string | null;
  salary: { min: number | null; max: number | null; currency: string | null; period: string | null };
  postedAt: string; source: string; excerpt: string | null; score: number;
}

type SourceState = { name: string; status: string; scanned?: number; matched?: number };

const MODE_STYLE: Record<string, string> = {
  remote: "border-teal-dim bg-teal-dim/40 text-teal",
  hybrid: "border-accent-dim bg-accent-dim/25 text-accent",
  onsite: "border-line bg-elevated text-fg-muted",
  unspecified: "border-line bg-elevated text-fg-faint",
};

export function LiveResults({ q, l }: { q: string; l: string }) {
  const [jobs, setJobs] = useState<LiveJob[]>([]);
  const [sources, setSources] = useState<SourceState[]>([]);
  const [scanned, setScanned] = useState(0);
  const [finished, setFinished] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [boards, setBoards] = useState(0);
  const startedAt = useRef(Date.now());

  useEffect(() => {
    if (!q && !l) return;

    setJobs([]); setSources([]); setScanned(0); setFinished(false); setError(null);
    startedAt.current = Date.now();

    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (l) params.set("l", l);
    const stream = new EventSource(`/api/search/stream?${params}`);

    stream.onmessage = (message) => {
      const event = JSON.parse(message.data);

      if (event.type === "start") {
        setBoards(event.boards);
        setSources(event.sources.map((name: string) => ({ name, status: "queued" })));
      } else if (event.type === "source") {
        setSources((current) => {
          const next = current.filter((s) => s.name !== event.name);
          return [...next, { name: event.name, status: event.status, scanned: event.scanned, matched: event.matched }]
            .sort((a, b) => a.name.localeCompare(b.name));
        });
        if (event.scanned) setScanned((n) => n + event.scanned);
      } else if (event.type === "results") {
        // Merge and re-rank, so the best match is top even though results
        // arrive in whatever order the sources happen to finish.
        setJobs((current) => [...current, ...event.jobs].sort((a, b) => b.score - a.score));
      } else if (event.type === "done") {
        setFinished(true);
        stream.close();
      } else if (event.type === "error") {
        setError(event.message);
      }
    };

    stream.onerror = () => {
      // A closed stream after completion is normal; only surface a genuine
      // interruption.
      setFinished((done) => {
        if (!done) setError("The search connection dropped. Try again.");
        return true;
      });
      stream.close();
    };

    return () => stream.close();
  }, [q, l]);

  const completed = sources.filter((s) => s.status === "done" || s.status === "error").length;
  const percent = sources.length ? Math.round((completed / sources.length) * 100) : 0;
  const seconds = ((Date.now() - startedAt.current) / 1000).toFixed(0);

  if (!q && !l) {
    return (
      <p className="px-4 py-16 text-center text-sm text-fg-muted">
        Enter a job title or a place to search.
      </p>
    );
  }

  return (
    <div>
      {!finished ? (
        <div className="border-b border-line px-4 py-3">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-[13px] text-fg">
              Searching {sources.length} sources across {boards} company career pages…
            </p>
            <span className="font-[family-name:var(--font-mono)] text-[11px] text-fg-faint">
              {jobs.length} found · {scanned.toLocaleString()} scanned
            </span>
          </div>

          <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-line-soft">
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-500"
              style={{ width: `${Math.max(4, percent)}%` }}
            />
          </div>

          <ul className="mt-2.5 flex flex-wrap gap-1.5">
            {sources.map((source) => (
              <li
                key={source.name}
                className={`rounded border px-1.5 py-0.5 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-wide ${
                  source.status === "done"
                    ? "border-teal-dim bg-teal-dim/30 text-teal"
                    : source.status === "error"
                      ? "border-line bg-elevated text-fg-faint line-through"
                      : "border-line bg-elevated text-fg-muted animate-pulse"
                }`}
                title={source.status}
              >
                {labelFor(SOURCE_LABELS, source.name)}
                {source.matched ? ` ${source.matched}` : ""}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="flex items-baseline justify-between gap-3 border-b border-line px-4 py-2.5">
          <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.1em] text-fg-faint">
            {jobs.length} live {jobs.length === 1 ? "role" : "roles"}
          </p>
          <span className="font-[family-name:var(--font-mono)] text-[11px] text-fg-faint">
            {scanned.toLocaleString()} scanned in {seconds}s
          </span>
        </div>
      )}

      {error ? (
        <p className="border-b border-warn/40 bg-warn/10 px-4 py-2 text-[12px] text-warn">{error}</p>
      ) : null}

      {jobs.map((job) => {
        const salary = formatSalary({
          salaryMin: job.salary.min, salaryMax: job.salary.max,
          salaryCurrency: job.salary.currency, salaryPeriod: job.salary.period,
        });
        return (
          <a
            key={job.id}
            href={job.applyUrl ?? job.url}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="group block border-b border-line-soft px-4 py-3.5 transition-colors hover:bg-hover/60"
          >
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-[family-name:var(--font-display)] text-[15px] font-medium leading-snug text-fg group-hover:text-accent">
                {job.title}
              </h3>
              <time dateTime={job.postedAt} className="shrink-0 pt-0.5 font-[family-name:var(--font-mono)] text-[11px] text-fg-faint">
                {relativeDate(job.postedAt)}
              </time>
            </div>

            <p className="mt-1 truncate text-[13px] text-fg-muted">
              <span className="text-fg">{job.company}</span>
              <span className="text-fg-faint"> · {job.location}</span>
            </p>

            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              <span className={`rounded border px-1.5 py-0.5 text-[11px] leading-4 ${MODE_STYLE[job.workMode] ?? MODE_STYLE.unspecified}`}>
                {job.workMode === "onsite" ? "On-site" : job.workMode === "unspecified" ? "Not stated" : job.workMode[0]!.toUpperCase() + job.workMode.slice(1)}
              </span>
              <span className="rounded border border-line bg-elevated px-1.5 py-0.5 text-[11px] leading-4 text-fg-muted">
                {labelFor(SENIORITY_LABELS, job.seniority)}
              </span>
              {job.jobFunction ? (
                <span className="text-[11px] text-fg-faint">{labelFor(FUNCTION_LABELS, job.jobFunction)}</span>
              ) : null}
              <span className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-wide text-fg-faint">
                via {labelFor(SOURCE_LABELS, job.source)}
              </span>
              {salary ? (
                <span className="ml-auto font-[family-name:var(--font-mono)] text-[12px] text-teal">{salary}</span>
              ) : null}
            </div>
          </a>
        );
      })}

      {finished && jobs.length === 0 && !error ? (
        <div className="px-4 py-16 text-center">
          <p className="text-sm text-fg-muted">
            No live openings matched {q ? <strong className="text-fg">{q}</strong> : null}
            {q && l ? " in " : null}
            {l ? <strong className="text-fg">{l}</strong> : null}.
          </p>
          <p className="mx-auto mt-2 max-w-md text-[12px] leading-relaxed text-fg-faint">
            Every source was searched just now, so this reflects what is actually open —
            not a stale index. Try a broader title, a nearby city, or leave the location
            blank to see remote roles.
          </p>
        </div>
      ) : null}
    </div>
  );
}
