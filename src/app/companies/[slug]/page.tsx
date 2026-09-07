import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { JobCard } from "@/components/job-card";
import { Pagination } from "@/components/pagination";
import { parseSearchParams } from "@/lib/search/params";
import { getCompanyBySlug, searchJobs } from "@/lib/search/query";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const company = await getCompanyBySlug(slug);
  if (!company) return { title: "Company not found" };
  return {
    title: `Jobs at ${company.name}`,
    description: `Open roles at ${company.name}, taken straight from their careers page. Apply directly with the employer.`,
    alternates: { canonical: `/companies/${company.slug}` },
  };
}

export default async function CompanyPage({ params, searchParams }: Props) {
  const [{ slug }, raw] = await Promise.all([params, searchParams]);
  const company = await getCompanyBySlug(slug);
  if (!company) notFound();

  const search = { ...parseSearchParams(raw), company: slug };
  const { jobs, total, page, perPage } = await searchJobs(search);

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-6">
      <header className="border-b border-line pb-5">
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-fg">
          Jobs at {company.name}
        </h1>
        <p className="mt-1.5 text-sm text-fg-muted">
          {total} open {total === 1 ? "role" : "roles"}
          {company.atsPlatform ? (
            <span className="text-fg-faint"> · sourced from their {company.atsPlatform} careers page</span>
          ) : null}
        </p>
        {company.website ? (
          <a
            href={company.website}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="mt-2 inline-block text-[13px] text-accent hover:underline"
          >
            {company.website.replace(/^https?:\/\//, "")}
          </a>
        ) : null}
      </header>

      <div className="mt-1">
        {jobs.length === 0 ? (
          <p className="py-12 text-center text-sm text-fg-muted">
            No open roles right now.{" "}
            <Link href="/jobs" className="text-accent hover:underline">Browse all jobs</Link>
          </p>
        ) : (
          jobs.map((job) => <JobCard key={job.id} job={job} href={`/jobs/${job.slug}`} />)
        )}
      </div>

      <Pagination
        params={search}
        page={page}
        perPage={perPage}
        total={total}
        basePath={`/companies/${slug}`}
      />
    </main>
  );
}
