import Link from "next/link";

import { JobCard } from "@/components/job-card";
import { SearchBar } from "@/components/search-bar";
import { brand } from "@/config/brand";
import { FUNCTION_LABELS, labelFor } from "@/lib/search/labels";
import { countActiveJobs, loadFacets, searchJobs } from "@/lib/search/query";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [{ jobs }, facets, total] = await Promise.all([
    searchJobs({ perPage: 6 }),
    loadFacets({}),
    countActiveJobs(),
  ]);

  const topFunctions = facets.jobFunction.slice(0, 12);
  const topCountries = facets.country.slice(0, 8);

  return (
    <main>
      <section className="relative overflow-hidden border-b border-line px-4 py-16 sm:py-24">
        {/* Rails receding into the distance — the brand mark, scaled up. */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-[0.07]">
          <svg width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 100 100">
            <path d="M20 100 L46 0M80 100 L54 0" stroke="var(--color-accent)" strokeWidth="0.4" />
            {Array.from({ length: 14 }, (_, i) => {
              const t = i / 13;
              const y = 100 - t * 100;
              const spread = 30 * (1 - t) + 4;
              return <path key={i} d={`M${50 - spread} ${y} H${50 + spread}`} stroke="var(--color-fg)" strokeWidth="0.25" />;
            })}
          </svg>
        </div>

        <div className="relative mx-auto max-w-3xl text-center">
          <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.2em] text-accent">
            {total.toLocaleString()} open roles · free, no account needed
          </p>
          <h1 className="mt-4 font-[family-name:var(--font-display)] text-4xl font-semibold leading-[1.1] tracking-tight text-fg sm:text-5xl">
            {brand.tagline}
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-fg-muted">
            Jobs pulled directly from company career pages and open job feeds — every
            industry, every function, worldwide. You apply with the employer, not through us.
          </p>

          <div className="mx-auto mt-8 max-w-2xl">
            <SearchBar size="lg" />
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-center gap-1.5 text-[12px]">
            <span className="text-fg-faint">Popular:</span>
            {["Software Engineer", "Nurse", "Accountant", "Civil Engineer", "Sales"].map((term) => (
              <Link
                key={term}
                href={`/jobs?q=${encodeURIComponent(term)}`}
                className="rounded-full border border-line px-2.5 py-1 text-fg-muted transition-colors hover:border-accent hover:text-accent"
              >
                {term}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <section>
          <div className="flex items-baseline justify-between">
            <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-fg">
              Latest roles
            </h2>
            <Link href="/jobs" className="text-[13px] text-accent hover:underline">
              Browse all →
            </Link>
          </div>
          <div className="mt-3 overflow-hidden rounded-lg border border-line bg-surface">
            {jobs.map((job) => (
              <JobCard key={job.id} job={job} href={`/jobs/${job.slug}`} />
            ))}
          </div>
        </section>

        <aside className="space-y-8">
          <section>
            <h2 className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.15em] text-fg-faint">
              Browse by function
            </h2>
            <ul className="mt-3 space-y-1">
              {topFunctions.map((bucket) => (
                <li key={bucket.value}>
                  <Link
                    href={`/jobs?fn=${bucket.value}`}
                    className="flex items-baseline justify-between gap-2 rounded px-1.5 py-1 text-[13px] text-fg-muted transition-colors hover:bg-hover hover:text-fg"
                  >
                    <span className="truncate">{labelFor(FUNCTION_LABELS, bucket.value)}</span>
                    <span className="font-[family-name:var(--font-mono)] text-[11px] text-fg-faint">
                      {bucket.count}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.15em] text-fg-faint">
              Browse by country
            </h2>
            <ul className="mt-3 space-y-1">
              {topCountries.map((bucket) => (
                <li key={bucket.value}>
                  <Link
                    href={`/jobs?country=${bucket.value}`}
                    className="flex items-baseline justify-between gap-2 rounded px-1.5 py-1 text-[13px] text-fg-muted transition-colors hover:bg-hover hover:text-fg"
                  >
                    <span>{new Intl.DisplayNames(["en"], { type: "region" }).of(bucket.value)}</span>
                    <span className="font-[family-name:var(--font-mono)] text-[11px] text-fg-faint">
                      {bucket.count}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
    </main>
  );
}
