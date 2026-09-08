import Link from "next/link";

import { SearchBar } from "@/components/search-bar";
import { brand } from "@/config/brand";
import { JOB_TITLES } from "@/lib/search/catalogue";
import { FUNCTION_LABELS, labelFor } from "@/lib/search/labels";

export const dynamic = "force-static";

/** One representative title per function, for the browse links. */
const BY_FUNCTION = Object.entries(
  JOB_TITLES.reduce<Record<string, string[]>>((acc, entry) => {
    (acc[entry.function] ??= []).push(entry.title);
    return acc;
  }, {}),
).slice(0, 16);

const POPULAR = [
  "Digital Marketing Manager", "Software Engineer", "Registered Nurse",
  "Accountant", "Civil Engineer", "Sales Manager", "Data Analyst", "Electrician",
];

export default function HomePage() {
  return (
    <main>
      <section className="relative overflow-hidden border-b border-line px-4 py-16 sm:py-24">
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
            Live search · free · no account needed
          </p>
          <h1 className="mt-4 font-[family-name:var(--font-display)] text-4xl font-semibold leading-[1.1] tracking-tight text-fg sm:text-5xl">
            {brand.tagline}
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-fg-muted">
            Every search goes straight to company career pages and job feeds, the moment
            you ask. No stale index, no reposts — you apply with the employer, not through us.
          </p>

          <div className="mx-auto mt-8 max-w-2xl">
            <SearchBar size="lg" autoFocus />
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-center gap-1.5 text-[12px]">
            <span className="text-fg-faint">Popular:</span>
            {POPULAR.map((term) => (
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

      <section className="mx-auto max-w-5xl px-4 py-12">
        <h2 className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.15em] text-fg-faint">
          Browse by function
        </h2>
        <div className="mt-4 grid gap-x-8 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
          {BY_FUNCTION.map(([fn, titles]) => (
            <Link
              key={fn}
              href={`/jobs?q=${encodeURIComponent(titles[0]!)}`}
              className="flex items-baseline justify-between gap-2 rounded px-1.5 py-1.5 text-[13px] text-fg-muted transition-colors hover:bg-hover hover:text-fg"
            >
              <span className="truncate">{labelFor(FUNCTION_LABELS, fn)}</span>
              <span className="shrink-0 font-[family-name:var(--font-mono)] text-[11px] text-fg-faint">
                {titles.length} titles
              </span>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
