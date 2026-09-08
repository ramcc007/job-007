import type { Metadata } from "next";

import { LiveResults } from "@/components/live-results";
import { SearchBar } from "@/components/search-bar";
import { brand } from "@/config/brand";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const params = await searchParams;
  const q = first(params.q);
  const l = first(params.l);
  const what = [q, l].filter(Boolean).join(" in ");
  return {
    title: what ? `${what} jobs` : "Search jobs",
    description: brand.description,
    // Results are generated per request against live sources, so there is
    // nothing stable for a crawler to index here.
    robots: { index: false, follow: true },
  };
}

export default async function JobsPage({ searchParams }: Props) {
  const params = await searchParams;
  const q = first(params.q);
  const l = first(params.l);

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-6">
      <div className="mb-5">
        <SearchBar q={q} l={l} size="lg" />
      </div>
      <div className="overflow-hidden rounded-lg border border-line bg-surface">
        <LiveResults q={q} l={l} />
      </div>
      <p className="mt-4 text-[12px] leading-relaxed text-fg-faint">
        Every search queries company career pages and job feeds directly, at the moment
        you ask. Nothing is cached, so what you see is what is open right now — and why
        a search takes a few seconds.
      </p>
    </main>
  );
}
