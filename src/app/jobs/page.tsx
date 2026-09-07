import type { Metadata } from "next";
import Link from "next/link";

import { FacetRail } from "@/components/facet-rail";
import { JobCard } from "@/components/job-card";
import { JobDetail } from "@/components/job-detail";
import { Pagination } from "@/components/pagination";
import { brand } from "@/config/brand";
import { parseSearchParams, toggleUrl } from "@/lib/search/params";
import { getJobBySlug, loadFacets, searchJobs } from "@/lib/search/query";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Search jobs",
  description: brand.description,
};

const SORTS = [
  { value: "recent", label: "Newest" },
  { value: "relevance", label: "Relevance" },
  { value: "salary", label: "Salary" },
] as const;

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const params = parseSearchParams(raw);
  const selectedSlug = Array.isArray(raw.selected) ? raw.selected[0] : raw.selected;

  const [{ jobs, total, page, perPage }, facets] = await Promise.all([
    searchJobs(params),
    loadFacets(params),
  ]);

  // The right-hand pane shows the explicitly selected job, else the first
  // result — so the layout is never a dead empty column.
  const detailSlug = selectedSlug ?? jobs[0]?.slug;
  const detail = detailSlug ? await getJobBySlug(detailSlug) : null;

  const keepSelected = (slug: string) => {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(raw)) {
      if (key === "selected") continue;
      const v = Array.isArray(value) ? value[0] : value;
      if (v) search.set(key, v);
    }
    search.set("selected", slug);
    return `/jobs?${search.toString()}`;
  };

  return (
    <main className="grid min-h-[calc(100dvh-3.5rem)] grid-cols-1 lg:grid-cols-[15rem_minmax(0,1fr)] xl:grid-cols-[15rem_28rem_minmax(0,1fr)]">
      {/* Facets — a drawer on mobile, a permanent rail from lg up. */}
      <aside className="border-b border-line px-4 py-3 lg:sticky lg:top-14 lg:h-[calc(100dvh-3.5rem)] lg:overflow-y-auto lg:border-b-0 lg:border-r">
        <details className="lg:hidden">
          <summary className="cursor-pointer list-none rounded border border-line px-3 py-2 text-sm text-fg-muted">
            Filters {total > 0 ? `(${total} results)` : ""}
          </summary>
          <div className="mt-3">
            <FacetRail facets={facets} params={params} />
          </div>
        </details>
        <div className="hidden lg:block">
          <FacetRail facets={facets} params={params} />
        </div>
      </aside>

      {/* Result list. */}
      <section className="flex min-w-0 flex-col border-line xl:sticky xl:top-14 xl:h-[calc(100dvh-3.5rem)] xl:border-r">
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5">
          <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.1em] text-fg-faint">
            {total.toLocaleString()} {total === 1 ? "role" : "roles"}
          </p>
          <div className="flex items-center gap-1">
            {SORTS.map((sort) => {
              const isActive = (params.sort ?? "recent") === sort.value;
              return (
                <Link
                  key={sort.value}
                  href={toggleUrl({ ...params, sort: undefined }, "sort", sort.value)}
                  className={`rounded px-2 py-0.5 text-[11px] transition-colors ${
                    isActive ? "bg-accent-dim/30 text-accent" : "text-fg-faint hover:text-fg-muted"
                  }`}
                >
                  {sort.label}
                </Link>
              );
            })}
          </div>
        </div>

        <div className="min-h-0 flex-1 xl:overflow-y-auto">
          {jobs.length === 0 ? (
            <div className="px-4 py-16 text-center">
              <p className="text-sm text-fg-muted">No roles match these filters.</p>
              <Link href="/jobs" className="mt-2 inline-block text-[13px] text-accent hover:underline">
                Clear all filters
              </Link>
            </div>
          ) : (
            jobs.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                href={keepSelected(job.slug)}
                selected={job.slug === detailSlug}
              />
            ))
          )}
        </div>

        <Pagination params={params} page={page} perPage={perPage} total={total} />
      </section>

      {/* Detail pane — desktop only; smaller screens navigate to the page. */}
      <section className="hidden xl:sticky xl:top-14 xl:block xl:h-[calc(100dvh-3.5rem)]">
        {detail ? (
          <JobDetail job={detail} />
        ) : (
          <div className="grid h-full place-items-center px-6 text-center">
            <p className="text-sm text-fg-faint">Select a role to see the details.</p>
          </div>
        )}
      </section>
    </main>
  );
}
